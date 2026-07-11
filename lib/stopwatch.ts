export interface StopwatchState {
  running: boolean;
  startedAt: number;
  pausedElapsed: number;
}

export function createStopwatchState(): StopwatchState {
  return {
    running: false,
    startedAt: 0,
    pausedElapsed: 0,
  };
}

export function getElapsed(state: StopwatchState, now: number): number {
  if (!state.running) {
    return state.pausedElapsed;
  }
  return state.pausedElapsed + (now - state.startedAt);
}
