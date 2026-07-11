'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loadConfig, saveConfig, getDefaultConfig, AppConfig } from '@/lib/config';
import { applyThemeCss, getThemeName, themes } from '@/lib/themes';
import ClockDisplay from './ClockDisplay';
import TimerDisplay from './TimerDisplay';
import StopwatchDisplay from './StopwatchDisplay';
import CountdownDisplay from './CountdownDisplay';

type Mode = 'clock' | 'timer' | 'stopwatch' | 'countdown';

const MODES: { key: Mode; label: string; shortcut: string }[] = [
  { key: 'clock', label: 'CLOCK', shortcut: 'C' },
  { key: 'timer', label: 'TIMER', shortcut: 'T' },
  { key: 'stopwatch', label: 'STOPWATCH', shortcut: 'W' },
  { key: 'countdown', label: 'COUNTDOWN', shortcut: 'D' },
];

const MODE_COLORS: Record<Mode, string> = {
  clock: '#00ff00',
  timer: '#ff6600',
  stopwatch: '#00ccff',
  countdown: '#ff3366',
};

interface ClockAppProps {
  mode: string;
  color?: string;
  size?: string;
}

function getNamedColor(name: string): string {
  const map: Record<string, string> = {
    green: '#00ff00',
    red: '#ff0000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    white: '#ffffff',
    black: '#000000',
    orange: '#ff6600',
    purple: '#800080',
    pink: '#ff3366',
  };
  return map[name.toLowerCase()] || '#00ff00';
}

export default function ClockApp({ mode: initialMode, color, size }: ClockAppProps) {
  const router = useRouter();

  const [config, setConfig] = useState<AppConfig>(getDefaultConfig);
  const [mode, setMode] = useState<Mode>(() => {
    if ((['clock', 'timer', 'stopwatch', 'countdown'] as string[]).includes(initialMode)) {
      return initialMode as Mode;
    }
    return 'clock';
  });
  const [widgetThemeIndex, setWidgetThemeIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // After mount: load from localStorage to restore saved config/theme
  useEffect(() => {
    setMounted(true);
    const cfg = loadConfig();
    setConfig(cfg);
    setWidgetThemeIndex(cfg.clock.widget_theme_index || 0);
    // On first visit (no saved config), default to retro theme
    if (localStorage.getItem('tclock-config') === null) {
      setWidgetThemeIndex(2);
      setConfig(prev => ({
        ...prev,
        clock: { ...prev.clock, widget_theme_index: 2 },
      }));
    }
  }, []);

  // Keep refs so the keyboard handler never has stale closures
  const configRef = useRef(config);
  configRef.current = config;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Persist config changes
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Apply theme CSS variables to root element
  useEffect(() => {
    const themeName = getThemeName(widgetThemeIndex);
    applyThemeCss(themeName);
  }, [widgetThemeIndex]);

  // Sync mode changes to URL — only push when mode actually changes
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      router.push(`?mode=${mode}`, { scroll: false });
    }
  }, [mode, router]);

  // Stable keyboard handler — never recreated
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Shift+T cycles widget theme
    if (e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const cfg = configRef.current;
      const themes = cfg.clock.widget_themes || ['default', 'nerv', 'retro'];
      const idx = (cfg.clock.widget_theme_index || 0) + 1;
      const next = idx % themes.length;
      setWidgetThemeIndex(next);
      setConfig(prev => ({
        ...prev,
        clock: { ...prev.clock, widget_theme_index: next },
      }));
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'c': setMode('clock'); break;
      case 't': setMode('timer'); break;
      case 'w': setMode('stopwatch'); break;
      case 'd': setMode('countdown'); break;
      case '1':
        setConfig(prev => ({
          ...prev,
          default: { ...prev.default, size: Math.max(1, prev.default.size - 1) },
        }));
        break;
      case '2':
        setConfig(prev => ({
          ...prev,
          default: { ...prev.default, size: Math.min(5, prev.default.size + 1) },
        }));
        break;
      case ' ':
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('tclock-toggle-pause'));
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentColor = color || config.default.color || MODE_COLORS[mode] || '#00ff00';
  const currentSize = size ? parseInt(size, 10) : config.default.size;
  const cssColor = currentColor.startsWith('#') ? currentColor : getNamedColor(currentColor);
  const themeName = getThemeName(widgetThemeIndex);
  const isRetro = themeName === 'retro';
  const isRetroClock = isRetro && mode === 'clock';
  const retroTabs = [
    { key: 'clock', label: 'CLOCK' },
    { key: 'timer', label: 'TIMER' },
    { key: 'stopwatch', label: 'STOPWATCH' },
    { key: 'countdown', label: 'COUNTDOWN' },
    { key: 'theme', label: 'THEME' },
  ];

  return (
    <div className={`flex flex-col min-h-screen w-full ${mounted && isRetro ? 'p-0 gap-0' : 'items-center justify-center p-4 gap-6'}`}>
      {/* Retro workspace header */}
      {isRetroClock && (
        <div className="retro-header">
          <div className="retro-tabs">
            {retroTabs.map((tab, i) => (
              <button
                key={i}
                className={`retro-tab ${mode === tab.key ? 'active' : ''}`}
                onClick={() => {
                  if (tab.key === 'theme') {
                    const themes = config.clock.widget_themes || ['default', 'nerv', 'retro'];
                    const idx = (widgetThemeIndex + 1) % themes.length;
                    setWidgetThemeIndex(idx);
                    setConfig(prev => ({
                      ...prev,
                      clock: { ...prev.clock, widget_theme_index: idx },
                    }));
                  } else {
                    setMode(tab.key as Mode);
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="retro-hostname">hal9000</div>
        </div>
      )}
      {/* Mode selector (hidden in retro clock mode) */}
      {(!mounted || !isRetroClock) && (
      <div className="flex gap-2 flex-wrap justify-center">
        {MODES.map(({ key, label, shortcut }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-3 py-1 text-xs font-mono border transition-colors ${
              mode === key ? '' : ''
            }`}
            style={{
              borderColor: mode === key ? MODE_COLORS[key] : 'var(--border-color)',
              color: mode === key ? MODE_COLORS[key] : 'var(--muted)',
              borderRadius: 'var(--border-radius)',
            }}
          >
            [{shortcut}] {label}
          </button>
        ))}
        <button
          onClick={() => {
            const themes = config.clock.widget_themes || ['default', 'nerv', 'retro'];
            const idx = (widgetThemeIndex + 1) % themes.length;
            setWidgetThemeIndex(idx);
            setConfig(prev => ({
              ...prev,
              clock: { ...prev.clock, widget_theme_index: idx },
            }));
          }}
          className="px-3 py-1 text-xs font-mono border transition-colors"
          style={{
            borderColor: 'var(--clock-color)',
            color: 'var(--clock-color)',
            borderRadius: 'var(--border-radius)',
          }}
        >
          THEME: {themes[widgetThemeIndex]?.label || 'default'}
        </button>
      </div>
      )}

      {/* Main display */}
      <div className={`flex-1 flex ${mounted && isRetroClock ? 'items-start' : 'items-center justify-center'} w-full`}>
        {!mounted ? (
          <div className="font-mono text-lg" style={{ color: 'var(--muted)' }}>tclock</div>
        ) : (<>
          {mode === 'clock' && (
            <ClockDisplay
              config={config.clock}
              size={currentSize}
              color={cssColor}
              themeIndex={widgetThemeIndex}
              onThemeChange={setWidgetThemeIndex}
            />
          )}
          {mode === 'timer' && (
            <TimerDisplay config={config.timer} size={currentSize} color={cssColor} />
          )}
          {mode === 'stopwatch' && (
            <StopwatchDisplay size={currentSize} color={cssColor} />
          )}
          {mode === 'countdown' && (
            <CountdownDisplay config={config.countdown} size={currentSize} color={cssColor} />
          )}
        </>)}
      </div>

      {/* Footer hint */}
      {(!mounted || !isRetroClock) && (
      <div className="text-xs font-mono mt-4 text-center" style={{ color: 'var(--muted)' }}>
        {mounted ? `1/2: size · C/T/W/D: mode · Shift+T: ${themes[widgetThemeIndex]?.label || 'theme'} · Space: pause` : '1/2: size · C/T/W/D: mode · Shift+T: theme · Space: pause'}
      </div>
      )}
    </div>
  );
}
