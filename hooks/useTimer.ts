'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createTimerState, remainingTime, elapsedInCurrent, getCurrentDuration, TimerState } from '@/lib/timer';

interface UseTimerOptions {
  durations: string[];
  repeat: boolean;
  autoQuit: boolean;
  execute: string[];
}

export function useTimer({ durations, repeat, autoQuit, execute }: UseTimerOptions) {
  const [state, setState] = useState<TimerState>(() =>
    createTimerState(durations, repeat, autoQuit, execute)
  );
  const [remaining, setRemaining] = useState(() => getCurrentDuration(state));
  const [finished, setFinished] = useState(false);
  const [execResult, setExecResult] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const now = Date.now();
    setState(prev => {
      const rem = remainingTime(prev, now);
      setRemaining(rem);

      if (rem <= 0 && prev.running) {
        // Current duration finished
        const nextIndex = prev.currentIndex + 1;

        if (nextIndex >= prev.durations.length) {
          // All durations done
          if (prev.repeat) {
            return { ...prev, currentIndex: 0, startedAt: now, pausedElapsed: 0 };
          } else {
            setFinished(true);
            return { ...prev, running: false, finished: true };
          }
        } else {
          // Move to next duration
          return { ...prev, currentIndex: nextIndex, startedAt: now, pausedElapsed: 0 };
        }
      }
      return prev;
    });
  }, []);

  const start = useCallback(() => {
    setFinished(false);
    setExecResult(null);
    setState(prev => {
      if (prev.currentIndex >= prev.durations.length) {
        // Reset if all done
        const fresh = createTimerState(prev.durations, prev.repeat, prev.autoQuit, prev.execute);
        return { ...fresh, running: true, startedAt: Date.now() };
      }
      setRemaining(getCurrentDuration(prev));
      return { ...prev, running: true, startedAt: Date.now(), finished: false };
    });
  }, []);

  const pause = useCallback(() => {
    setState(prev => {
      if (!prev.running) return prev;
      const now = Date.now();
      const elapsed = prev.pausedElapsed + (now - prev.startedAt);
      return { ...prev, running: false, pausedElapsed: elapsed };
    });
  }, []);

  const resume = useCallback(() => {
    setState(prev => ({
      ...prev,
      running: true,
      startedAt: Date.now(),
    }));
  }, []);

  const toggle = useCallback(() => {
    setState(prev => {
      if (prev.running) {
        const now = Date.now();
        const elapsed = prev.pausedElapsed + (now - prev.startedAt);
        return { ...prev, running: false, pausedElapsed: elapsed };
      } else {
        return { ...prev, running: true, startedAt: Date.now() };
      }
    });
  }, []);

  const reset = useCallback(() => {
    setState(prev => createTimerState(prev.durations, prev.repeat, prev.autoQuit, prev.execute));
    setRemaining(getCurrentDuration(state));
    setFinished(false);
    setExecResult(null);
  }, []);

  useEffect(() => {
    if (state.running) {
      intervalRef.current = setInterval(tick, 100);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.running, tick]);

  // Execute command when timer finishes
  useEffect(() => {
    if (finished && execute.length > 0) {
      const cmd = execute.join(' ');
      // Simulate command execution
      setExecResult(`Executed: ${cmd}`);
    }
  }, [finished, execute]);

  return {
    state,
    remaining,
    finished,
    execResult,
    start,
    pause,
    resume,
    toggle,
    reset,
  };
}
