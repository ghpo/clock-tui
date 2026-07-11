export interface CountdownState {
  targetTime: number | null;
  running: boolean;
  continueOnZero: boolean;
  reverse: boolean;
  showMillis: boolean;
  title: string | null;
  finished: boolean;
}

export function createCountdownState(
  targetTime: number | null,
  continueOnZero: boolean,
  reverse: boolean,
  showMillis: boolean,
  title: string | null,
): CountdownState {
  return {
    targetTime,
    running: false,
    continueOnZero,
    reverse,
    showMillis,
    title,
    finished: false,
  };
}

export function remainingTime(state: CountdownState, now: number): number {
  if (state.targetTime === null) return 0;
  const diff = state.targetTime - now;
  if (state.reverse) {
    // count up from zero, negate the diff
    const elapsed = state.targetTime - now;
    return Math.max(0, -diff);
  }
  return Math.max(0, diff);
}
