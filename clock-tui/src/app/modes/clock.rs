use crate::clock_text::font::bricks::BricksFont;
use crate::clock_text::ClockText;
use crate::config::ClockWidgetConfig;
use chrono::{Local, Utc};
use chrono_tz::Tz;
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Direction, Layout, Rect},
    style::Style,
    widgets::Widget,
};

use super::clock_widget::{clock_size_for_area, ClockWidgets};
use super::render_centered;

pub(crate) struct Clock {
    pub size: u16,
    pub style: Style,
    pub show_date: bool,
    pub show_millis: bool,
    pub show_secs: bool,
    pub timezone: Option<Tz>,
    widgets: ClockWidgets,
}

impl Clock {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn new(
        size: u16,
        style: Style,
        show_date: bool,
        show_millis: bool,
        show_secs: bool,
        timezone: Option<Tz>,
        widgets: Vec<ClockWidgetConfig>,
    ) -> Self {
        Self {
            size,
            style,
            show_date,
            show_millis,
            show_secs,
            timezone,
            widgets: ClockWidgets::new(widgets),
        }
    }

    pub(crate) fn tick(&mut self) {
        self.widgets.tick();
    }
}

impl Widget for &Clock {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let now = if let Some(ref tz) = self.timezone {
            Utc::now().with_timezone(tz).naive_local()
        } else {
            Local::now().naive_local()
        };
        let mut time_str = now.format("%H:%M:%S%.3f").to_string();
        if self.show_millis {
            time_str.truncate(time_str.len() - 2);
        } else if !self.show_secs {
            time_str.truncate(time_str.len() - 7);
        } else {
            time_str.truncate(time_str.len() - 4);
        }
        let time_str = time_str.as_str();
        let header = if self.show_date {
            let mut title = now.format("%Y-%m-%d").to_string();
            if let Some(tz) = self.timezone {
                title.push(' ');
                title.push_str(tz.name());
            }
            Some(title)
        } else {
            None
        };

        if self.widgets.is_empty() {
            self.render_clock(area, buf, time_str, header, self.size);
        } else {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints(vec![Constraint::Percentage(50), Constraint::Percentage(50)])
                .split(area);
            let clock_area = chunks[0];
            let widgets_area = chunks[1];
            let size = clock_size_for_area(time_str.chars().count(), clock_area, header.is_some());

            self.render_clock(clock_area, buf, time_str, header, size);
            self.widgets
                .render(widgets_area, area, buf, Style::default());
        }
    }
}

impl Clock {
    fn render_clock(
        &self,
        area: Rect,
        buf: &mut Buffer,
        time_str: &str,
        header: Option<String>,
        size: u16,
    ) {
        let font = BricksFont::new(size);
        let text = ClockText::new(time_str.to_string(), &font, self.style);
        render_centered(area, buf, &text, header, None);
    }
}
