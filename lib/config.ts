export type WidgetPosition = 'auto' | 'bottom';

export interface ClockWidgetConfig {
  title: string;
  command: string | string[];
  position: WidgetPosition;
  refresh_secs: number;
  timeout_secs: number;
}

export interface DefaultConfig {
  mode: string;
  color: string;
  size: number;
}

export interface ClockConfig {
  showDate: boolean;
  showSeconds: boolean;
  showMillis: boolean;
  timezone: string | null;
  widgets: ClockWidgetConfig[];
  widget_themes: string[];
  widget_theme_index: number;
}

export interface TimerConfig {
  durations: string[];
  titles: string[];
  repeat: boolean;
  showMillis: boolean;
  startPaused: boolean;
  autoQuit: boolean;
  execute: string[];
}

export interface StopwatchConfig {}

export interface CountdownConfig {
  time: string | null;
  title: string | null;
  showMillis: boolean;
  continueOnZero: boolean;
  reverse: boolean;
}

export interface AppConfig {
  default: DefaultConfig;
  clock: ClockConfig;
  timer: TimerConfig;
  stopwatch: StopwatchConfig;
  countdown: CountdownConfig;
  _version?: number;
}

export const DEFAULT_WIDGET_THEMES = ['default', 'nerv', 'retro'];
export const DEFAULT_WIDGET_REFRESH_SECS = 15 * 60;
export const DEFAULT_WIDGET_TIMEOUT_SECS = 30;

export function getDefaultConfig(): AppConfig {
  return {
    default: {
      mode: 'clock',
      color: 'green',
      size: 1,
    },
    clock: {
      showDate: true,
      showSeconds: true,
      showMillis: false,
      timezone: null,
      widgets: [
        {
          title: 'System Health',
          command: 'tclock-system-health',
          position: 'auto',
          refresh_secs: 10,
          timeout_secs: 10,
        },
        {
          title: 'GitHub Pending',
          command: 'ghpending',
          position: 'auto',
          refresh_secs: 900,
          timeout_secs: 30,
        },
        {
          title: 'Google Calendar',
          command: 'tclock-gcalcli --military',
          position: 'auto',
          refresh_secs: 120,
          timeout_secs: 30,
        },
      ],
      widget_themes: ['default', 'nerv', 'retro'],
      widget_theme_index: 0,
    },
    timer: {
      durations: ['25m', '5m'],
      titles: [],
      repeat: false,
      showMillis: true,
      startPaused: false,
      autoQuit: false,
      execute: [],
    },
    stopwatch: {},
    countdown: {
      time: null,
      title: null,
      showMillis: false,
      continueOnZero: false,
      reverse: false,
    },
    _version: CONFIG_VERSION,
  };
}

const STORAGE_KEY = 'tclock-config';
const CONFIG_VERSION = 8;

export function loadConfig(): AppConfig {
  if (typeof window === 'undefined') return getDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration: if saved version is stale, reset widgets to defaults
      if ((parsed._version || 1) < CONFIG_VERSION) {
        const fresh = getDefaultConfig();
        const merged = deepMerge(fresh, parsed);
        // Replace saved widgets with fresh defaults on version bump
        merged.clock.widgets = fresh.clock.widgets;
        merged.clock.widget_themes = fresh.clock.widget_themes;
        merged.clock.widget_theme_index = fresh.clock.widget_theme_index;
        merged._version = CONFIG_VERSION;
        saveConfig(merged);
        return merged;
      }
      const result = deepMerge(getDefaultConfig(), parsed);
      // Always ensure widget_themes has the full 3 entries
      result.clock.widget_themes = ['default', 'nerv', 'retro'];
      // Ensure index is valid for 3 themes
      if (result.clock.widget_theme_index < 0 || result.clock.widget_theme_index > 2) {
        result.clock.widget_theme_index = 0;
      }
      return result;
    }
  } catch {
    // ignore
  }
  return getDefaultConfig();
}

export function saveConfig(config: AppConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function deepMerge<T>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(overrides as object)) {
    const k = key as keyof T;
    const overrideVal = overrides[k];
    if (overrideVal !== undefined) {
      if (
        typeof overrideVal === 'object' &&
        overrideVal !== null &&
        !Array.isArray(overrideVal) &&
        typeof result[k] === 'object' &&
        result[k] !== null &&
        !Array.isArray(result[k])
      ) {
        result[k] = deepMerge(result[k] as any, overrideVal as any);
      } else {
        (result as any)[k] = overrideVal;
      }
    }
  }
  return result;
}
