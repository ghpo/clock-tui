import { ClockConfig } from './config';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getTimeString(date: Date, config: ClockConfig): string {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();
  let millis = date.getMilliseconds();

  const parts: string[] = [];
  parts.push(pad2(hours));
  parts.push(pad2(minutes));

  if (config.showSeconds) {
    parts.push(pad2(seconds));
  }

  if (config.showMillis) {
    parts.push(`.${Math.floor(millis / 100)}`);
  }

  return parts.join(':');
}

export function getHeaderString(date: Date, timezone: string | null): string {
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  let header = `${dayName}, ${monthName} ${day} ${year}`;
  if (timezone) {
    header += ` ${timezone}`;
  }
  return header;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
