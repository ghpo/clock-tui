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
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Paragraph, Widget, Wrap},
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
        let area = padded_widget_area(area);
        let title = self
            .title
            .clone()
            .or_else(|| self.command.first().cloned())
            .unwrap_or_else(|| "widget".to_string());
        let paragraph = Paragraph::new(widget_text(&title, &self.output, style))
            .style(style)
            .wrap(Wrap { trim: false });

        paragraph.render(area, buf);
    }
}

fn padded_widget_area(area: Rect) -> Rect {
    let x_padding = u16::from(area.width > 2);
    let y_padding = u16::from(area.height > 2);

    Rect {
        x: area.x + x_padding,
        y: area.y + y_padding,
        width: area.width.saturating_sub(x_padding * 2),
        height: area.height.saturating_sub(y_padding * 2),
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
    if silent_kill("-TERM", &process_group) {
        thread::sleep(Duration::from_millis(100));
        let _ = silent_kill("-KILL", &process_group);
    }
}

#[cfg(unix)]
fn silent_kill(signal: &str, process_group: &str) -> bool {
    Command::new("kill")
        .arg(signal)
        .arg(process_group)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn terminate_process_group(_pid: u32) {}

fn format_output(success: bool, stdout: Vec<u8>, stderr: Vec<u8>) -> String {
    let stdout = normalize_output(&String::from_utf8_lossy(&stdout));
    let stderr = normalize_output(&String::from_utf8_lossy(&stderr));

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

fn normalize_output(output: &str) -> String {
    output.replace('\r', "").trim_end().to_string()
}

fn widget_text(title: &str, output: &str, base_style: Style) -> Text<'static> {
    let title_style = base_style
        .fg(Color::Gray)
        .add_modifier(Modifier::BOLD)
        .remove_modifier(Modifier::DIM);
    let marker_style = base_style
        .fg(Color::Cyan)
        .add_modifier(Modifier::BOLD)
        .remove_modifier(Modifier::DIM);
    let mut lines = vec![Line::from(vec![
        Span::styled("● ".to_string(), marker_style),
        Span::styled(title.to_string(), title_style),
    ])];

    lines.extend(ansi_lines(output, base_style));
    Text::from(lines)
}

fn ansi_lines(output: &str, base_style: Style) -> Vec<Line<'static>> {
    let mut lines = Vec::new();
    let mut spans = Vec::new();
    let mut text = String::new();
    let mut style = base_style;
    let mut chars = output.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\n' {
            push_span(&mut spans, &mut text, style);
            lines.push(Line::from(spans));
            spans = Vec::new();
        } else if ch == '\x1b' {
            match chars.peek() {
                Some('[') => {
                    chars.next();
                    let mut sequence = String::new();
                    let mut final_byte = None;
                    for next in chars.by_ref() {
                        if ('@'..='~').contains(&next) {
                            final_byte = Some(next);
                            break;
                        }
                        sequence.push(next);
                    }

                    if final_byte == Some('m') {
                        push_span(&mut spans, &mut text, style);
                        style = apply_sgr_sequence(style, base_style, &sequence);
                    }
                }
                Some(']') => {
                    chars.next();
                    while let Some(next) = chars.next() {
                        if next == '\x07' {
                            break;
                        }

                        if next == '\x1b' && chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
                _ => {}
            }
        } else if ch != '\r' {
            text.push(ch);
        }
    }

    push_span(&mut spans, &mut text, style);
    lines.push(Line::from(spans));
    lines
}

fn push_span(spans: &mut Vec<Span<'static>>, text: &mut String, style: Style) {
    if !text.is_empty() {
        spans.push(Span::styled(std::mem::take(text), style));
    }
}

fn apply_sgr_sequence(mut style: Style, base_style: Style, sequence: &str) -> Style {
    let values = parse_sgr_values(sequence);
    let mut idx = 0;

    while idx < values.len() {
        match values[idx] {
            0 => style = base_style,
            1 => style = style.add_modifier(Modifier::BOLD),
            2 => style = style.add_modifier(Modifier::DIM),
            3 => style = style.add_modifier(Modifier::ITALIC),
            4 => style = style.add_modifier(Modifier::UNDERLINED),
            7 => style = style.add_modifier(Modifier::REVERSED),
            9 => style = style.add_modifier(Modifier::CROSSED_OUT),
            21 | 24 => style = remove_sgr_modifier(style, Modifier::UNDERLINED),
            22 => style = remove_sgr_modifier(style, Modifier::BOLD | Modifier::DIM),
            23 => style = remove_sgr_modifier(style, Modifier::ITALIC),
            27 => style = remove_sgr_modifier(style, Modifier::REVERSED),
            29 => style = remove_sgr_modifier(style, Modifier::CROSSED_OUT),
            30..=37 => style = style.fg(ansi_color(values[idx], false)),
            39 => style.fg = base_style.fg,
            40..=47 => style = style.bg(ansi_color(values[idx] - 10, false)),
            49 => style.bg = base_style.bg,
            90..=97 => style = style.fg(ansi_color(values[idx] - 60, true)),
            100..=107 => style = style.bg(ansi_color(values[idx] - 70, true)),
            38 if values.get(idx + 1) == Some(&5) => {
                if let Some(color) = values
                    .get(idx + 2)
                    .and_then(|value| u8::try_from(*value).ok())
                {
                    style = style.fg(Color::Indexed(color));
                    idx += 2;
                }
            }
            38 if values.get(idx + 1) == Some(&2) => {
                if let (Some(r), Some(g), Some(b)) = (
                    values
                        .get(idx + 2)
                        .and_then(|value| u8::try_from(*value).ok()),
                    values
                        .get(idx + 3)
                        .and_then(|value| u8::try_from(*value).ok()),
                    values
                        .get(idx + 4)
                        .and_then(|value| u8::try_from(*value).ok()),
                ) {
                    style = style.fg(Color::Rgb(r, g, b));
                    idx += 4;
                }
            }
            48 if values.get(idx + 1) == Some(&5) => {
                if let Some(color) = values
                    .get(idx + 2)
                    .and_then(|value| u8::try_from(*value).ok())
                {
                    style = style.bg(Color::Indexed(color));
                    idx += 2;
                }
            }
            48 if values.get(idx + 1) == Some(&2) => {
                if let (Some(r), Some(g), Some(b)) = (
                    values
                        .get(idx + 2)
                        .and_then(|value| u8::try_from(*value).ok()),
                    values
                        .get(idx + 3)
                        .and_then(|value| u8::try_from(*value).ok()),
                    values
                        .get(idx + 4)
                        .and_then(|value| u8::try_from(*value).ok()),
                ) {
                    style = style.bg(Color::Rgb(r, g, b));
                    idx += 4;
                }
            }
            _ => {}
        }
        idx += 1;
    }

    style
}

fn remove_sgr_modifier(mut style: Style, modifier: Modifier) -> Style {
    style.add_modifier.remove(modifier);
    style.sub_modifier.insert(modifier);
    style
}

fn parse_sgr_values(sequence: &str) -> Vec<u16> {
    if sequence.is_empty() {
        return vec![0];
    }

    sequence
        .split(';')
        .map(|value| value.parse::<u16>().unwrap_or(0))
        .collect()
}

fn ansi_color(value: u16, bright: bool) -> Color {
    match (value, bright) {
        (30, false) => Color::Black,
        (31, false) => Color::Red,
        (32, false) => Color::Green,
        (33, false) => Color::Yellow,
        (34, false) => Color::Blue,
        (35, false) => Color::Magenta,
        (36, false) => Color::Cyan,
        (37, false) => Color::Gray,
        (30, true) => Color::DarkGray,
        (31, true) => Color::LightRed,
        (32, true) => Color::LightGreen,
        (33, true) => Color::LightYellow,
        (34, true) => Color::LightBlue,
        (35, true) => Color::LightMagenta,
        (36, true) => Color::LightCyan,
        (37, true) => Color::White,
        _ => Color::Reset,
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
    let horizontal_margin = 4;
    let width_budget = area.width.saturating_sub(spacing + horizontal_margin) as usize;
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

    #[test]
    fn widget_output_preserves_ansi_for_rendering() {
        let output = format_output(true, b"\x1b[2mok\x1b[0m\r\n".to_vec(), Vec::new());

        assert_eq!(output, "\x1b[2mok\x1b[0m");
    }

    #[test]
    fn ansi_lines_render_sgr_as_styled_spans() {
        let lines = ansi_lines(
            "\x1b[2m19 projects checked\x1b[0m\n\x1b[36m\x1b[1mrepo/name\x1b[0m",
            Style::default(),
        );

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].spans[0].content, "19 projects checked");
        assert!(lines[0].spans[0].style.add_modifier.contains(Modifier::DIM));
        assert_eq!(lines[1].spans[0].content, "repo/name");
        assert_eq!(lines[1].spans[0].style.fg, Some(Color::Cyan));
        assert!(lines[1].spans[0]
            .style
            .add_modifier
            .contains(Modifier::BOLD));
    }

    #[test]
    fn ansi_lines_skip_osc_terminated_by_st() {
        let lines = ansi_lines(
            "\x1b]8;;https://example.test\x1b\\repo/name\x1b]8;;\x1b\\ ok",
            Style::default(),
        );

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].spans[0].content, "repo/name ok");
    }

    #[test]
    fn ansi_lines_render_common_sgr_attributes() {
        let lines = ansi_lines(
            "\x1b[3;4;9;42;48;5;196mstyled\x1b[23;24;29;49m plain",
            Style::default(),
        );

        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].spans[0].content, "styled");
        assert_eq!(lines[0].spans[0].style.bg, Some(Color::Indexed(196)));
        assert!(lines[0].spans[0]
            .style
            .add_modifier
            .contains(Modifier::ITALIC | Modifier::UNDERLINED | Modifier::CROSSED_OUT));
        assert_eq!(lines[0].spans[1].content, " plain");
        assert_eq!(lines[0].spans[1].style.bg, None);
        assert!(!lines[0].spans[1]
            .style
            .add_modifier
            .contains(Modifier::ITALIC | Modifier::UNDERLINED | Modifier::CROSSED_OUT));
    }
}
