'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCountdownOptions {
  targetTime: number | null;
  continueOnZero: boolean;
  reverse: boolean;
  showMillis: boolean;
  title: string | null;
}

export function useCountdown({ targetTime, continueOnZero, reverse, showMillis }: UseCountdownOptions) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(() =>
    targetTime ? Math.max(0, targetTime - Date.now()) : 0
  );
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const continueRef = useRef(continueOnZero);
  continueRef.current = continueOnZero;

  const tick = useCallback(() => {
    if (!targetTime) return;
    const now = Date.now();
    const diff = targetTime - now;
    const rem = reverse ? Math.max(0, -diff) : Math.max(0, diff);
    setRemaining(rem);

    if (rem <= 0 && !continueRef.current) {
      setFinished(true);
      setRunning(false);
    }
  }, [targetTime, reverse]);

  const start = useCallback(() => {
    if (!targetTime) return;
    setFinished(false);
    setRunning(true);
  }, [targetTime]);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const toggle = useCallback(() => {
    setRunning(prev => !prev);
  }, []);

  useEffect(() => {
    if (running && targetTime) {
      intervalRef.current = setInterval(tick, showMillis ? 100 : 500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, targetTime, showMillis, tick]);

  return { running, remaining, finished, start, pause, toggle };
}
