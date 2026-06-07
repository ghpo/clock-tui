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

use super::clock_widget::{clock_height_for_size, clock_size_for_area, ClockWidgets};
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
            let layout = clock_widgets_layout(area, time_str.chars().count(), header.is_some());

            self.render_clock(layout.clock_area, buf, time_str, header, layout.clock_size);
            self.widgets
                .render(layout.widgets_area, area, buf, Style::default());
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ClockWidgetsLayout {
    clock_area: Rect,
    widgets_area: Rect,
    clock_size: u16,
}

fn clock_widgets_layout(area: Rect, text_len: usize, has_header: bool) -> ClockWidgetsLayout {
    let clock_height_budget = clock_height_budget(area.height);
    let sizing_area = Rect {
        height: clock_height_budget,
        ..area
    };
    let clock_size = clock_size_for_area(text_len, sizing_area, has_header);
    let clock_height = clock_height_for_size(clock_size, has_header)
        .min(clock_height_budget)
        .min(area.height);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(clock_height), Constraint::Min(0)])
        .split(area);

    ClockWidgetsLayout {
        clock_area: chunks[0],
        widgets_area: chunks[1],
        clock_size,
    }
}

fn clock_height_budget(area_height: u16) -> u16 {
    if area_height == 0 {
        0
    } else {
        (area_height / 2).max(1)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn widgets_get_extra_height_when_width_limits_square_clock() {
        let layout = clock_widgets_layout(Rect::new(0, 0, 80, 80), 8, true);

        assert_eq!(layout.clock_size, 1);
        assert_eq!(layout.clock_area.height, 9);
        assert_eq!(layout.widgets_area.height, 71);
    }

    #[test]
    fn wide_clock_height_is_capped_to_top_half() {
        let layout = clock_widgets_layout(Rect::new(0, 0, 500, 50), 8, true);

        assert_eq!(layout.clock_size, 4);
        assert!(layout.clock_area.height <= 25);
        assert_eq!(layout.clock_area.height, 24);
        assert_eq!(layout.widgets_area.height, 26);
    }

    #[test]
    fn clock_layout_leaves_vertical_breathing_without_header() {
        let layout = clock_widgets_layout(Rect::new(0, 0, 500, 50), 8, false);

        assert_eq!(layout.clock_size, 4);
        assert_eq!(layout.clock_area.height, 22);
        assert_eq!(layout.widgets_area.height, 28);
    }

    #[test]
    fn clock_layout_handles_tiny_areas() {
        let layout = clock_widgets_layout(Rect::new(0, 0, 10, 1), 8, true);

        assert_eq!(layout.clock_area.height, 1);
        assert_eq!(layout.widgets_area.height, 0);
    }
}
