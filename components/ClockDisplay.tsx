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
  const themeName = currentTheme.name;
  const isRetro = !!(currentTheme?.retroLayout);

  useEffect(() => {
    const interval = config.showMillis ? 100 : 500;
    const id = setInterval(() => setDate(new Date()), interval);
    return () => clearInterval(id);
  }, [config.showMillis]);

  const timeStr = getTimeString(date, config);
  const headerStr = config.showDate ? getHeaderString(date, config.timezone) : null;
  const hasWidgets = config.widgets && config.widgets.length > 0;

  // Retro: date + big text clock + optional widgets below
  if (isRetro) {
    return (
      <div className="flex flex-col items-center w-full">
        {/* Date */}
        <div className="retro-date">{headerStr || ''}</div>

        {/* Big text clock */}
        <div className="w-full flex items-start justify-center retro-clock-spacer">
          <div className="retro-clock-text">{timeStr}</div>
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
        <BricksText text={timeStr} size={size} color={color} />
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
