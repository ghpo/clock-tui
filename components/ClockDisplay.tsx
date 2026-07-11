'use client';

import { useState, useEffect } from 'react';
import BricksText from './BricksText';
import { getTimeString, getHeaderString } from '@/lib/clock';
import { ClockConfig } from '@/lib/config';
import { themes } from '@/lib/themes';
import WidgetPanel from './WidgetPanel';

interface ClockDisplayProps {
  config: ClockConfig;
  size: number;
  color: string;
  themeIndex?: number;
  onThemeChange?: (index: number) => void;
}


export default function ClockDisplay({
  config,
  size,
  color,
  themeIndex = 0,
  onThemeChange,
}: ClockDisplayProps) {
  const [date, setDate] = useState(new Date());
  const [activeWidget, setActiveWidget] = useState<number | null>(null);
  const currentTheme = themes[themeIndex] || themes[0];
  const isRetro = !!(currentTheme?.retroLayout);

  useEffect(() => {
    const interval = config.showMillis ? 100 : 500;
    const id = setInterval(() => setDate(new Date()), interval);
    return () => clearInterval(id);
  }, [config.showMillis]);

  const timeStr = getTimeString(date, config);
  const headerStr = config.showDate ? getHeaderString(date, config.timezone) : null;
  const hasWidgets = config.widgets && config.widgets.length > 0;

  // retro mode: use theme's clock color so it changes when cycling themes
  const clockColor = isRetro ? (currentTheme.css['--clock-color'] || color) : color;

  // Retro: date + big text clock + optional widgets below
  if (isRetro) {
    return (
      <div className="flex flex-col items-center w-full">
        {/* Date */}
        <div className="retro-date">{headerStr || ''}</div>

        {/* Big text clock (JerseyM54 font, : via mono) */}
        <div className="w-full flex items-start justify-center retro-clock-spacer">
          <div className="retro-clock-text">
            {timeStr.split('').map((ch, i) =>
              ch === ':' ? (
                <span key={i} style={{ color: clockColor, fontFamily: 'var(--font-mono)', fontSize: '0.55em', lineHeight: 1, verticalAlign: 'middle' }}>:</span>
              ) : (
                <span key={i} style={{ color: clockColor }}>{ch}</span>
              )
            )}
          </div>
        </div>

        {/* Widgets */}
        {hasWidgets && (
          <div className="w-full retro-widgets-area">
            <WidgetPanel
              widgets={config.widgets}
              themeIndex={themeIndex}
              onThemeChange={onThemeChange || (() => {})}
              activeWidget={activeWidget}
              onActiveWidgetChange={setActiveWidget}
            />
          </div>
        )}
      </div>
    );
  }

  // Non-retro: original bricks layout
  return (
    <div className={`flex flex-col items-center w-full ${hasWidgets ? 'gap-2' : 'gap-4'}`}>
      <div className={`flex flex-col items-center justify-center ${hasWidgets ? 'gap-2' : 'gap-4'}`}>
        {headerStr && (
          <div className="text-sm font-mono tracking-wide" style={{ color }}>
            {headerStr}
          </div>
        )}
        <BricksText text={timeStr} size={size} color={clockColor} />
      </div>

      {hasWidgets && (
        <div className="w-full max-w-5xl mt-4">
          <WidgetPanel
            widgets={config.widgets}
            themeIndex={themeIndex}
            onThemeChange={onThemeChange || (() => {})}
            activeWidget={activeWidget}
            onActiveWidgetChange={setActiveWidget}
          />
        </div>
      )}
    </div>
  );
}
