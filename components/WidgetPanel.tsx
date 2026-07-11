'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ClockWidgetConfig } from '@/lib/config';
import { themes } from '@/lib/themes';
import { AnsiText, stripAnsi } from '@/lib/ansi';

interface WidgetOutput {
  title: string;
  output: string;
  error: string | null;
  loading: boolean;
  lastRun: number;
}

interface WidgetPanelProps {
  widgets: ClockWidgetConfig[];
  themeIndex: number;
  onThemeChange: (index: number) => void;
  activeWidget: number | null;
  onActiveWidgetChange: (index: number | null) => void;
}

export default function WidgetPanel({
  widgets,
  themeIndex,
  onThemeChange,
  activeWidget,
  onActiveWidgetChange,
}: WidgetPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);
  const [widgetStates, setWidgetStates] = useState<Map<number, WidgetOutput>>(new Map());
  const abortRefs = useRef<Map<number, AbortController>>(new Map());
  const timersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // Theme name from themeIndex
  const currentTheme = themes[themeIndex] || themes[0];
  const themeName = currentTheme.name;
  const themeLabel = currentTheme.label;
  const isRetro = !!(currentTheme?.retroLayout);

  // Measure viewport aspect ratio to decide columns (matching the Rust TUI logic)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Match Rust: aspect = width / (height * 2.0)
        // <= 1 → 2 cols, <= 2 → 4 cols, > 2 → 6 cols
        const aspect = width / (height * 2.0);
        if (aspect > 2) setColumns(6);
        else if (aspect > 1) setColumns(4);
        else setColumns(2);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch a single widget's data
  const fetchWidget = useCallback(async (index: number, widget: ClockWidgetConfig, theme?: string) => {
    // Abort any in-flight request for this widget
    const existing = abortRefs.current.get(index);
    if (existing) existing.abort();

    const controller = new AbortController();
    abortRefs.current.set(index, controller);

    setWidgetStates(prev => {
      const next = new Map(prev);
      next.set(index, { title: widget.title, output: '', error: null, loading: true, lastRun: Date.now() });
      return next;
    });

    try {
      const res = await fetch('/api/widget/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: widget.command,
          timeout_secs: widget.timeout_secs,
          theme: theme || undefined,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      setWidgetStates(prev => {
        const next = new Map(prev);
        if (data.ok) {
          next.set(index, { title: widget.title, output: data.output, error: null, loading: false, lastRun: Date.now() });
        } else {
          next.set(index, { title: widget.title, output: '', error: data.error || 'Unknown error', loading: false, lastRun: Date.now() });
        }
        return next;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setWidgetStates(prev => {
        const next = new Map(prev);
        next.set(index, { title: widget.title, output: '', error: `[error] ${err instanceof Error ? err.message : 'Fetch failed'}`, loading: false, lastRun: Date.now() });
        return next;
      });
    }
  }, []);

  // Start/restart fetch cycles when widgets config changes
  useEffect(() => {
    // Clear all existing timers
    timersRef.current.forEach(timer => clearInterval(timer));
    timersRef.current.clear();

    // Fetch each widget immediately, then set interval
    widgets.forEach((widget, index) => {
      const theme = themeName;
      fetchWidget(index, widget, theme);
      const refreshMs = Math.max(widget.refresh_secs * 1000, 1000);
      const timer = setInterval(() => {
        fetchWidget(index, widget, theme);
      }, refreshMs);
      timersRef.current.set(index, timer);
    });

    return () => {
      timersRef.current.forEach(timer => clearInterval(timer));
      timersRef.current.clear();
    };
  }, [widgets, fetchWidget, themeName]);

  // Separate auto and bottom widgets
  const autoWidgets = useMemo(
    () => widgets.map((w, i) => ({ widget: w, index: i })).filter(({ widget }) => widget.position !== 'bottom'),
    [widgets]
  );
  const bottomWidgets = useMemo(
    () => widgets.map((w, i) => ({ widget: w, index: i })).filter(({ widget }) => widget.position === 'bottom'),
    [widgets]
  );

  if (widgets.length === 0) return null;

  // Retro: two-column layout with section titles, no cards
  if (isRetro) {
    // Left column gets widgets[0], right column gets the rest
    const leftWidgets = widgets.slice(0, 1);
    const rightWidgets = widgets.slice(1);

    return (
      <div ref={containerRef} className="retro-content">
        {/* Left column — first widget */}
        <div className="retro-column-left">
          {leftWidgets.map((widget, idx) => {
            const state = widgetStates.get(idx);
            const output = state?.output || state?.error || '';
            const lines = output.split('\n').filter(l => l.trim());
            return (
              <div key={idx} className="retro-section">
                <div className="retro-section-title">
                  <span className="icon">{'❯'}</span>
                  {widget.title}
                </div>
                <div className="retro-widget-output">
                  {state?.loading ? (
                    <span style={{ color: 'var(--muted)' }}>Running...</span>
                  ) : state?.error ? (
                    <span style={{ color: 'var(--danger)' }}>{stripAnsi(state.error)}</span>
                  ) : lines.length > 0 ? (
                    lines.map((line, i) => (
                      <AnsiText key={i} text={line + '\n'} />
                    ))
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>No output</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column — remaining widgets */}
        <div className="retro-column-right">
          {rightWidgets.map((widget, idx) => {
            const index = leftWidgets.length + idx;
            const state = widgetStates.get(index);
            const output = state?.output || state?.error || '';
            const lines = output.split('\n').filter(l => l.trim());
            return (
              <div key={index} className="retro-section">
                <div className="retro-section-title">
                  <span className="icon">{'❯'}</span>
                  {widget.title}
                </div>
                <div className="retro-widget-output">
                  {state?.loading ? (
                    <span style={{ color: 'var(--muted)' }}>Running...</span>
                  ) : state?.error ? (
                    <span style={{ color: 'var(--danger)' }}>{stripAnsi(state.error)}</span>
                  ) : lines.length > 0 ? (
                    lines.map((line, i) => (
                      <AnsiText key={i} text={line + '\n'} />
                    ))
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>No output</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-4">
      {/* Auto-positioned widgets in grid */}
      {autoWidgets.length > 0 && (
        <div
          className="grid gap-2 w-full"
          style={{
            gridTemplateColumns: `repeat(${Math.min(columns, autoWidgets.length)}, 1fr)`,
          }}
        >
          {autoWidgets.map(({ widget, index }) => {
            const state = widgetStates.get(index);
            return (
              <WidgetCard
                key={index}
                widget={widget}
                state={state}
                isActive={activeWidget === index}
                onClick={() => onActiveWidgetChange(activeWidget === index ? null : index)}
              />
            );
          })}
        </div>
      )}

      {/* Bottom-positioned widgets as full-width bands */}
      {bottomWidgets.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {bottomWidgets.map(({ widget, index }) => {
            const state = widgetStates.get(index);
            return (
              <WidgetBand
                key={index}
                widget={widget}
                state={state}
                isActive={activeWidget === index}
                onClick={() => onActiveWidgetChange(activeWidget === index ? null : index)}
              />
            );
          })}
        </div>
      )}

      {/* Theme indicator */}
      <div className="text-[10px] font-mono text-center" style={{ color: 'var(--muted)' }}>
        Shift+T: {themeLabel}
      </div>
    </div>
  );
}

// Individual widget card (for auto-positioned widgets)
function WidgetCard({
  widget,
  state,
  isActive,
  onClick,
}: {
  widget: ClockWidgetConfig;
  state?: WidgetOutput;
  isActive: boolean;
  onClick: () => void;
}) {
  const lines = useMemo(() => {
    if (!state) return [];
    const text = state.output || state.error || '';
    return text.split('\n').filter(l => l.trim());
  }, [state]);

  return (
    <div
      className={`border transition-colors cursor-pointer overflow-hidden ${
        isActive ? 'border-zinc-500' : 'border-zinc-800'
      }`}
      onClick={onClick}
      style={{
        borderRadius: 'var(--border-radius)',
        borderColor: isActive ? 'var(--fg-dim)' : 'var(--border-color)',
        backgroundColor: 'var(--surface)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-2 py-1 text-xs font-mono border-b"
        style={{
          borderBottomColor: 'var(--border-color)',
          backgroundColor: 'var(--surface-alt)',
        }}
      >
        <span className={`w-2 h-2 rounded-full ${state?.loading ? 'bg-yellow-500 animate-pulse' : state?.error ? 'bg-red-500' : 'bg-green-500'}`} />
        <span className="font-bold" style={{ color: 'var(--section-title-color)' }}>{widget.title}</span>
        {state && !state.loading && (
          <span className="ml-auto text-[10px]" style={{ color: 'var(--muted)' }}>
            {Math.round((Date.now() - state.lastRun) / 1000)}s ago
          </span>
        )}
      </div>

      {/* Output */}
      <div className="px-2 py-1.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
        {state?.loading ? (
          <span style={{ color: 'var(--muted)' }} className="italic">Running...</span>
        ) : state?.error ? (
          <span style={{ color: 'var(--danger)' }}>{stripAnsi(state.error)}</span>
        ) : (
          lines.length > 0 ? (
            lines.map((line, i) => (
              <div key={i} className="hover:bg-white/[0.02]">
                <AnsiText text={line + '\n'} />
              </div>
            ))
          ) : (
            <span style={{ color: 'var(--muted)' }} className="italic">No output</span>
          )
        )}
      </div>
    </div>
  );
}

// Full-width widget band (for bottom-positioned widgets)
function WidgetBand({
  widget,
  state,
  isActive,
  onClick,
}: {
  widget: ClockWidgetConfig;
  state?: WidgetOutput;
  isActive: boolean;
  onClick: () => void;
}) {
  const lines = useMemo(() => {
    if (!state) return [];
    const text = state.output || state.error || '';
    return text.split('\n').filter(l => l.trim());
  }, [state]);

  return (
    <div
      className={`border transition-colors cursor-pointer w-full ${
        isActive ? 'border-zinc-500' : 'border-zinc-800'
      }`}
      onClick={onClick}
      style={{
        borderRadius: 'var(--border-radius)',
        borderColor: isActive ? 'var(--fg-dim)' : 'var(--border-color)',
        backgroundColor: 'var(--surface)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-2 py-1 text-xs font-mono border-b"
        style={{
          borderBottomColor: 'var(--border-color)',
          backgroundColor: 'var(--surface-alt)',
        }}
      >
        <span className={`w-2 h-2 rounded-full ${state?.loading ? 'bg-yellow-500 animate-pulse' : state?.error ? 'bg-red-500' : 'bg-green-500'}`} />
        <span className="font-bold" style={{ color: 'var(--section-title-color)' }}>{widget.title}</span>
      </div>

      {/* Output */}
      <div className="px-2 py-1.5 font-mono text-xs leading-relaxed whitespace-pre-wrap w-full max-h-24 overflow-y-auto">
        {state?.loading ? (
          <span style={{ color: 'var(--muted)' }} className="italic">Running...</span>
        ) : state?.error ? (
          <span style={{ color: 'var(--danger)' }}>{stripAnsi(state.error)}</span>
        ) : (
          lines.length > 0 ? (
            <div className="flex flex-wrap gap-x-4">
              {lines.map((line, i) => (
                <span key={i} className="whitespace-nowrap">
                  <AnsiText text={line} />
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--muted)' }} className="italic">No output</span>
          )
        )}
      </div>
    </div>
  );
}
