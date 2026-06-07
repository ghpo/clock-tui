use std::{
    cell::Cell,
    io::Read,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, Sender},
        Arc,
    },
    thread,
    thread::JoinHandle,
    time::{Duration, Instant},
};

use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Direction, Layout, Rect},
    style::Style,
    widgets::{Block, Borders, Paragraph, Widget, Wrap},
};

use crate::config::ClockWidgetConfig;

const DEFAULT_REFRESH: Duration = Duration::from_secs(15 * 60);
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_WIDGETS: usize = 6;
const CELL_HEIGHT_TO_WIDTH_RATIO: f32 = 2.0;

pub(crate) struct ClockWidgets {
    widgets: Vec<ClockWidget>,
    tx: Sender<WidgetMessage>,
    rx: Receiver<WidgetMessage>,
    cancel: Arc<AtomicBool>,
    visible_count: Cell<usize>,
}

struct ClockWidget {
    title: Option<String>,
    command: Vec<String>,
    refresh: Duration,
    timeout: Duration,
    output: String,
    running: bool,
    next_run: Instant,
    handle: Option<JoinHandle<()>>,
}

struct WidgetMessage {
    index: usize,
    output: String,
}

impl ClockWidgets {
    pub(crate) fn new(configs: Vec<ClockWidgetConfig>) -> Self {
        let (tx, rx) = mpsc::channel();
        let now = Instant::now();
        let cancel = Arc::new(AtomicBool::new(false));
        let widgets = configs
            .into_iter()
            .take(MAX_WIDGETS)
            .map(|config| ClockWidget {
                title: config.title,
                command: config.command,
                refresh: duration_or_default(config.refresh_secs, DEFAULT_REFRESH),
                timeout: duration_or_default(config.timeout_secs, DEFAULT_TIMEOUT),
                output: "Loading...".to_string(),
                running: false,
                next_run: now,
                handle: None,
            })
            .collect();

        Self {
            widgets,
            tx,
            rx,
            cancel,
            visible_count: Cell::new(0),
        }
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.widgets.is_empty()
    }

    pub(crate) fn tick(&mut self) {
        let now = Instant::now();
        let mut finished_handles = Vec::new();

        while let Ok(message) = self.rx.try_recv() {
            if let Some(widget) = self.widgets.get_mut(message.index) {
                widget.output = message.output;
                widget.running = false;
                widget.next_run = now + widget.refresh;
                if let Some(handle) = widget.handle.take() {
                    finished_handles.push(handle);
                }
            }
        }

        for handle in finished_handles {
            let _ = handle.join();
        }

        let visible_count = self.visible_count.get().min(self.widgets.len());
        for (index, widget) in self.widgets.iter_mut().enumerate().take(visible_count) {
            if widget.running || now < widget.next_run {
                continue;
            }

            widget.running = true;
            let command = widget.command.clone();
            let timeout = widget.timeout;
            let tx = self.tx.clone();
            let cancel = self.cancel.clone();

            widget.handle = Some(thread::spawn(move || {
                let output = run_command(command, timeout, cancel);
                let _ = tx.send(WidgetMessage { index, output });
            }));
        }
    }

    pub(crate) fn render(&self, area: Rect, terminal_area: Rect, buf: &mut Buffer, style: Style) {
        let count = visible_widget_count(terminal_area, self.widgets.len());
        self.visible_count.set(count);
        if count == 0 {
            return;
        }

        let constraints = (0..count)
            .map(|_| Constraint::Ratio(1, count as u32))
            .collect::<Vec<_>>();
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints(constraints)
            .split(area);

        for (widget, area) in self.widgets.iter().take(count).zip(chunks.iter()) {
            widget.render(*area, buf, style);
        }
    }
}

impl Drop for ClockWidgets {
    fn drop(&mut self) {
        self.cancel.store(true, Ordering::Relaxed);
        for widget in &mut self.widgets {
            if let Some(handle) = widget.handle.take() {
                let _ = handle.join();
            }
        }
    }
}

impl ClockWidget {
    fn render(&self, area: Rect, buf: &mut Buffer, style: Style) {
        let title = self
            .title
            .clone()
            .or_else(|| self.command.first().cloned())
            .unwrap_or_else(|| "widget".to_string());
        let block = Block::default().borders(Borders::ALL).title(title);
        let paragraph = Paragraph::new(self.output.as_str())
            .style(style)
            .block(block)
            .wrap(Wrap { trim: false });

        paragraph.render(area, buf);
    }
}

fn duration_or_default(secs: u64, default: Duration) -> Duration {
    if secs == 0 {
        default
    } else {
        Duration::from_secs(secs)
    }
}

fn run_command(command: Vec<String>, timeout: Duration, cancel: Arc<AtomicBool>) -> String {
    if command.is_empty() {
        return "[error] missing command".to_string();
    }

    let mut child_command = Command::new(&command[0]);
    child_command
        .args(&command[1..])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        child_command.process_group(0);
    }

    let mut child = match child_command.spawn() {
        Ok(child) => child,
        Err(error) => return format!("[error] failed to start {}: {}", command[0], error),
    };

    let stdout = child
        .stdout
        .take()
        .map(|mut stdout| thread::spawn(move || read_to_end(&mut stdout)));
    let stderr = child
        .stderr
        .take()
        .map(|mut stderr| thread::spawn(move || read_to_end(&mut stderr)));

    let started_at = Instant::now();
    loop {
        if cancel.load(Ordering::Relaxed) {
            terminate_child(&mut child);
            let _ = child.wait();
            let _ = join_output(stdout);
            let _ = join_output(stderr);
            return "[cancelled]".to_string();
        }

        match child.try_wait() {
            Ok(Some(_status)) => {
                let status = match child.wait() {
                    Ok(status) => status,
                    Err(error) => return format!("[error] failed to wait for command: {}", error),
                };
                terminate_process_group(child.id());
                let stdout = join_output(stdout);
                let stderr = join_output(stderr);
                return format_output(status.success(), stdout, stderr);
            }
            Ok(None) if started_at.elapsed() >= timeout => {
                terminate_child(&mut child);
                let _ = child.wait();
                let _ = join_output(stdout);
                let _ = join_output(stderr);
                return format!("[timeout] command exceeded {}s", timeout.as_secs());
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(error) => {
                let _ = child.kill();
                return format!("[error] failed to wait for command: {}", error);
            }
        }
    }
}

fn read_to_end(reader: &mut impl Read) -> Vec<u8> {
    let mut output = Vec::new();
    let _ = reader.read_to_end(&mut output);
    output
}

fn join_output(handle: Option<JoinHandle<Vec<u8>>>) -> Vec<u8> {
    handle
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default()
}

fn terminate_child(child: &mut Child) {
    #[cfg(unix)]
    {
        terminate_process_group(child.id());
        if matches!(child.try_wait(), Ok(None)) {
            let _ = child.kill();
        }
    }

    #[cfg(not(unix))]
    {
        let _ = child.kill();
    }
}

#[cfg(unix)]
fn terminate_process_group(pid: u32) {
    let process_group = format!("-{}", pid);
    if Command::new("kill")
        .arg("-TERM")
        .arg(&process_group)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
    {
        thread::sleep(Duration::from_millis(100));
        let _ = Command::new("kill")
            .arg("-KILL")
            .arg(process_group)
            .status();
    }
}

#[cfg(not(unix))]
fn terminate_process_group(_pid: u32) {}

fn format_output(success: bool, stdout: Vec<u8>, stderr: Vec<u8>) -> String {
    let stdout = String::from_utf8_lossy(&stdout).trim_end().to_string();
    let stderr = String::from_utf8_lossy(&stderr).trim_end().to_string();

    if success {
        if stdout.is_empty() {
            "[ok]".to_string()
        } else {
            stdout
        }
    } else if stderr.is_empty() {
        format!("[error] {}", stdout)
    } else {
        format!("[error] {}", stderr)
    }
}

pub(crate) fn visible_widget_count(area: Rect, configured_count: usize) -> usize {
    configured_count.min(max_widgets_for_area(area))
}

pub(crate) fn max_widgets_for_area(area: Rect) -> usize {
    let height = area.height.max(1) as f32;
    let aspect = area.width as f32 / (height * CELL_HEIGHT_TO_WIDTH_RATIO);

    if aspect < 1.5 {
        2
    } else if aspect < 2.2 {
        4
    } else {
        6
    }
}

pub(crate) fn clock_size_for_area(text_len: usize, area: Rect, has_header: bool) -> u16 {
    if text_len == 0 {
        return 1;
    }

    let spacing = 2 * text_len.saturating_sub(1) as u16;
    let width_budget = area.width.saturating_sub(spacing) as usize;
    let width_size = width_budget / (6 * text_len);

    let header_rows = if has_header { 4 } else { 0 };
    let height_budget = area.height.saturating_sub(header_rows) as usize;
    let height_size = height_budget / 5;

    width_size.min(height_size).max(1) as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn max_widgets_follows_terminal_aspect_ratio() {
        assert_eq!(max_widgets_for_area(Rect::new(0, 0, 100, 50)), 2);
        assert_eq!(max_widgets_for_area(Rect::new(0, 0, 160, 45)), 4);
        assert_eq!(max_widgets_for_area(Rect::new(0, 0, 240, 50)), 6);
    }

    #[test]
    fn visible_widgets_never_exceed_configured_count() {
        let area = Rect::new(0, 0, 240, 50);
        assert_eq!(visible_widget_count(area, 0), 0);
        assert_eq!(visible_widget_count(area, 3), 3);
        assert_eq!(visible_widget_count(area, 10), 6);
    }

    #[test]
    fn clock_size_fits_width_and_height() {
        let area = Rect::new(0, 0, 80, 20);
        let size = clock_size_for_area(8, area, true);
        let width = 8 * (6 * size + 2) - 2;
        let height = 5 * size + 4;

        assert!(width <= area.width);
        assert!(height <= area.height);
    }

    #[test]
    fn clock_size_handles_tiny_areas() {
        assert_eq!(clock_size_for_area(8, Rect::new(0, 0, 1, 1), true), 1);
    }
}
