'use client';

import { useMemo } from 'react';
import BricksText from './BricksText';
import { useStopwatch } from '@/hooks/useStopwatch';
import { formatDuration, DurationFormat } from '@/lib/modes';

interface StopwatchDisplayProps {
  size: number;
  color: string;
}

export default function StopwatchDisplay({ size, color }: StopwatchDisplayProps) {
  const sw = useStopwatch();

  const displayStr = useMemo(
    () => formatDuration(sw.elapsed, DurationFormat.HourMinSecDeci),
    [sw.elapsed]
  );

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <BricksText text={displayStr} size={size} color={color} />
      <div className="flex gap-3 mt-2">
        {!sw.state.running && sw.elapsed === 0 && (
          <button
            onClick={sw.start}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            START
          </button>
        )}
        {sw.state.running && (
          <button
            onClick={sw.pause}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            PAUSE
          </button>
        )}
        {!sw.state.running && sw.elapsed > 0 && (
          <button
            onClick={sw.start}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            RESUME
          </button>
        )}
        {sw.elapsed > 0 && (
          <button
            onClick={sw.reset}
            className="px-4 py-1 rounded font-mono text-sm border"
            style={{ borderColor: color, color }}
          >
            RESET
          </button>
        )}
      </div>
      {!sw.state.running && sw.elapsed > 0 && (
        <div className="text-xs font-mono" style={{ color: '#ffff00' }}>
          PAUSED
        </div>
      )}
    </div>
  );
}
