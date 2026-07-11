'use client';

import { useMemo } from 'react';
import BricksText from './BricksText';
import { useCountdown } from '@/hooks/useCountdown';
import { formatDuration, DurationFormat, shouldFlash } from '@/lib/modes';
import { CountdownConfig } from '@/lib/config';

interface CountdownDisplayProps {
  config: CountdownConfig;
  size: number;
  color: string;
}

export default function CountdownDisplay({ config, size, color }: CountdownDisplayProps) {
  const targetTime = config.time ? new Date(config.time).getTime() : null;
  const cdown = useCountdown({
    targetTime,
    continueOnZero: config.continueOnZero,
    reverse: config.reverse,
    showMillis: config.showMillis,
    title: config.title ?? null,
  });

  const displayFormat = config.showMillis ? DurationFormat.HourMinSecDeci : DurationFormat.HourMinSec;
  const displayStr = useMemo(
    () => formatDuration(cdown.remaining, displayFormat),
    [cdown.remaining, displayFormat]
  );

  const flash = cdown.finished && shouldFlash(Date.now());

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {config.title && (
        <div className="text-sm font-mono" style={{ color }}>
          {config.title}
        </div>
      )}
      <div style={{ opacity: flash ? 0.3 : 1, transition: 'opacity 0.1s' }}>
        <BricksText text={displayStr} size={size} color={color} />
      </div>
      <div className="flex gap-3 mt-2">
        {!cdown.running && !cdown.finished && targetTime && (
          <button
            onClick={cdown.start}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            START
          </button>
        )}
        {cdown.running && (
          <button
            onClick={cdown.pause}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            PAUSE
          </button>
        )}
      </div>
      {targetTime && (
        <div className="text-xs font-mono" style={{ color }}>
          Target: {new Date(targetTime).toLocaleString()}
        </div>
      )}
      {cdown.finished && (
        <div className="text-xs font-mono" style={{ color: '#ffff00' }}>
          COUNTDOWN COMPLETE
        </div>
      )}
    </div>
  );
}
