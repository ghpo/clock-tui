export enum DurationFormat {
  HourMinSecDeci = 'HourMinSecDeci',
  HourMinSec = 'HourMinSec',
}

/**
 * Format milliseconds into a display string.
 *
 * HourMinSecDeci: "1:05:32.1" (shows deciseconds)
 * HourMinSec:     "1:05:32" (no decimal)
 *
 * Negative values get a "-" prefix.
 * Days shown as "D:" prefix when >= 24 hours.
 */
export function formatDuration(ms: number, format: DurationFormat): string {
  const negative = ms < 0;
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const deci = format === DurationFormat.HourMinSecDeci
    ? Math.floor((abs % 1000) / 100)
    : -1;

  if (totalSec >= 86400) {
    const days = Math.floor(totalSec / 86400);
    const rem = totalSec % 86400;
    const h = Math.floor(rem / 3600);
    const m = Math.floor((rem % 3600) / 60);
    const s = rem % 60;
    const prefix = negative ? '-' : '';
    if (deci >= 0) {
      return `${prefix}${days}:${pad2(h)}:${pad2(m)}:${pad2(s)}.${deci}`;
    }
    return `${prefix}${days}:${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const prefix = negative ? '-' : '';

  if (deci >= 0) {
    return `${prefix}${h}:${pad2(m)}:${pad2(s)}.${deci}`;
  }
  return `${prefix}${h}:${pad2(m)}:${pad2(s)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Flash effect: first 500ms of every 1000ms period.
 * Returns true if the display should show flash state.
 */
export function shouldFlash(ms: number): boolean {
  return Math.abs(ms) % 1000 < 500;
}

/**
 * Parse a duration string like "5m", "25m", "1h", "30s" into milliseconds.
 */
export function parseDuration(s: string): number {
  const match = s.match(/^(\d+)\s*([smhd])$/);
  if (!match) return 0;
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 3600 * 1000;
    case 'd': return val * 86400 * 1000;
    default: return 0;
  }
}
