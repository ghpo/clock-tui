import { parseDuration } from './modes';

export interface TimerState {
  durations: string[];
  currentIndex: number;
  elapsedMs: number;
  running: boolean;
  startedAt: number;
  pausedElapsed: number;
  repeat: boolean;
  autoQuit: boolean;
  execute: string[];
  finished: boolean;
}

export function createTimerState(durations: string[], repeat: boolean, autoQuit: boolean, execute: string[]): TimerState {
  return {
    durations,
    currentIndex: 0,
    elapsedMs: 0,
    running: false,
    startedAt: 0,
    pausedElapsed: 0,
    repeat,
    autoQuit,
    execute,
    finished: false,
  };
}

export function getCurrentDuration(state: TimerState): number {
  if (state.currentIndex >= state.durations.length) return 0;
  return parseDuration(state.durations[state.currentIndex]);
}

export function remainingTime(state: TimerState, now: number): number {
  if (!state.running) {
    return getCurrentDuration(state) - state.pausedElapsed;
  }
  const elapsed = state.pausedElapsed + (now - state.startedAt);
  return Math.max(0, getCurrentDuration(state) - elapsed);
}

export function elapsedInCurrent(state: TimerState, now: number): number {
  if (!state.running) {
    return state.pausedElapsed;
  }
  return state.pausedElapsed + (now - state.startedAt);
}

export function getTotalDuration(state: TimerState): number {
  return state.durations.reduce((sum, d) => sum + parseDuration(d), 0);
}

export function getElapsedAcrossAll(state: TimerState, now: number): number {
  if (!state.running) {
    return state.pausedElapsed;
  }
  return state.pausedElapsed + (now - state.startedAt);
}
