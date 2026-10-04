'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playShowdownReelTick, playShowdownReelWhoosh } from '@/lib/audio/skins/showdown';

const TICK_MS_MIN = 26;
const TICK_MS_MAX = 72;

function clamp(v: number, max: number) {
  return Math.min(max, Math.max(0, Math.round(v)));
}

export function useShowdownReel(value: number, remaining: number, onChange: (v: number) => void) {
  const [display, setDisplay] = useState(value);
  const [spinning, setSpinning] = useState(false);
  const [tickDir, setTickDir] = useState<'up' | 'down' | null>(null);
  const [tickKey, setTickKey] = useState(0);
  const displayRef = useRef(value);
  const spinningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickResetRef.current) clearTimeout(tickResetRef.current);
    timerRef.current = null;
    tickResetRef.current = null;
  }, []);

  useEffect(() => {
    if (spinningRef.current) return;
    displayRef.current = value;
    setDisplay(value);
  }, [value]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const spinTo = useCallback(
    (target: number) => {
      if (spinningRef.current) return;

      const to = clamp(target, remaining);
      const from = displayRef.current;
      if (to === from) return;

      clearTimers();

      const dir = to > from ? 1 : -1;
      const steps = Math.abs(to - from);
      const totalMs = Math.min(160 + steps * 52, 1100);
      const stepMs =
        steps >= 8
          ? Math.max(20, totalMs / steps)
          : Math.max(TICK_MS_MIN, Math.min(TICK_MS_MAX, totalMs / steps));

      spinningRef.current = true;
      setSpinning(true);
      if (steps >= 3) playShowdownReelWhoosh(steps);

      let current = from;
      let stepIdx = 0;

      const runStep = () => {
        current += dir;
        stepIdx += 1;
        displayRef.current = current;
        setDisplay(current);
        onChange(current);

        const dirLabel = dir > 0 ? 'up' : 'down';
        setTickDir(dirLabel);
        setTickKey((k) => k + 1);
        if (tickResetRef.current) clearTimeout(tickResetRef.current);
        tickResetRef.current = setTimeout(() => setTickDir(null), Math.min(stepMs * 0.9, 64));

        playShowdownReelTick(stepIdx - 1, steps);

        if (current !== to) {
          timerRef.current = setTimeout(runStep, stepMs);
        } else {
          spinningRef.current = false;
          setSpinning(false);
        }
      };

      timerRef.current = setTimeout(runStep, 0);
    },
    [remaining, onChange, clearTimers],
  );

  return { display, spinning, tickDir, tickKey, spinTo };
}
