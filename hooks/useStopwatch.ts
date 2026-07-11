'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createStopwatchState, getElapsed, StopwatchState } from '@/lib/stopwatch';

export function useStopwatch() {
  const [state, setState] = useState<StopwatchState>(createStopwatchState);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const now = Date.now();
    setState(prev => {
      const e = getElapsed(prev, now);
      setElapsed(e);
      return prev;
    });
  }, []);

  const start = useCallback(() => {
    setState(prev => ({
      ...prev,
      running: true,
      startedAt: Date.now(),
    }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => {
      if (!prev.running) return prev;
      const now = Date.now();
      const e = prev.pausedElapsed + (now - prev.startedAt);
      setElapsed(e);
      return { ...prev, running: false, pausedElapsed: e };
    });
  }, []);

  const toggle = useCallback(() => {
    setState(prev => {
      if (prev.running) {
        const now = Date.now();
        const e = prev.pausedElapsed + (now - prev.startedAt);
        setElapsed(e);
        return { ...prev, running: false, pausedElapsed: e };
      } else {
        return { ...prev, running: true, startedAt: Date.now() };
      }
    });
  }, []);

  const reset = useCallback(() => {
    setState(createStopwatchState());
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (state.running) {
      intervalRef.current = setInterval(tick, 100);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.running, tick]);

  return { state, elapsed, start, pause, toggle, reset };
}
