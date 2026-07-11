'use client';

import { useMemo } from 'react';
import BricksText from './BricksText';
import { useTimer } from '@/hooks/useTimer';
import { formatDuration, DurationFormat, shouldFlash } from '@/lib/modes';
import { TimerConfig } from '@/lib/config';

interface TimerDisplayProps {
  config: TimerConfig;
  size: number;
  color: string;
  globalPaused?: boolean;
  onGlobalPause?: () => void;
}

export default function TimerDisplay({ config, size, color, globalPaused, onGlobalPause }: TimerDisplayProps) {
  const timer = useTimer({
    durations: config.durations,
    repeat: config.repeat,
    autoQuit: config.autoQuit,
    execute: config.execute,
  });

  const displayFormat = config.showMillis ? DurationFormat.HourMinSecDeci : DurationFormat.HourMinSec;
  const displayStr = useMemo(
    () => formatDuration(timer.remaining, displayFormat),
    [timer.remaining, displayFormat]
  );

  const flash = timer.finished && shouldFlash(Date.now());
  const currentTitle = config.titles[timer.state.currentIndex] || null;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {currentTitle && (
        <div className="text-sm font-mono" style={{ color }}>
          {currentTitle}
        </div>
      )}
      <div style={{ opacity: flash ? 0.3 : 1, transition: 'opacity 0.1s' }}>
        <BricksText text={displayStr} size={size} color={color} />
      </div>
      <div className="flex gap-3 mt-2">
        {!timer.state.running && !timer.finished ? (
          <button
            onClick={timer.start}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            START
          </button>
        ) : timer.state.running ? (
          <button
            onClick={timer.pause}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            PAUSE
          </button>
        ) : null}
        {timer.state.running && (
          <button
            onClick={timer.reset}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            RESET
          </button>
        )}
        {timer.finished && (
          <button
            onClick={timer.start}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            RESTART
          </button>
        )}
      </div>
      {timer.state.running && (
        <div className="text-xs font-mono" style={{ color }}>
          {config.durations[timer.state.currentIndex]}
        </div>
      )}
      {timer.finished && (
        <div className="text-xs font-mono" style={{ color: '#ffff00' }}>
          {timer.execResult || 'TIMES UP'}
        </div>
      )}
    </div>
  );
}
