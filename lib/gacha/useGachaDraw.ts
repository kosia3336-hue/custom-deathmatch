'use client';

import { useCallback, useRef, useState } from 'react';
import { gachaTitleGrantedSuppress } from './suppress-title-granted';
import type { GachaDrawResponse, GachaPayMode, GachaPoolResponse } from './types';

export type GachaPhase = 'idle' | 'drawing' | 'reveal' | 'bulk';

function minDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useGachaDraw() {
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [result, setResult] = useState<GachaDrawResponse | null>(null);
  const [busy, setBusy] = useState(false);
  // setBusy 는 비동기라 연속 클릭 방어에 못 쓴다 — ref 로 즉시 잠근다.
  const busyRef = useRef(false);

  const run = useCallback(
    async (
      reducedMotion: boolean,
      payMode: GachaPayMode,
      count: number,
    ): Promise<GachaDrawResponse | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setPhase('drawing');
      setResult(null);
      gachaTitleGrantedSuppress.active = true;

      const minMs = reducedMotion ? 400 : count > 1 ? 900 : 1500;

      try {
        const [res] = await Promise.all([
          fetch('/api/shop/gacha/draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gachaId: 'default', payMode, count }),
          }),
          minDelay(minMs),
        ]);

        const json = await res.json();
        if (!res.ok || !json.ok) {
          setPhase('idle');
          gachaTitleGrantedSuppress.active = false;
          throw Object.assign(new Error(json.error ?? 'draw failed'), { code: json.code });
        }

        const ok = json as GachaDrawResponse;
        setResult(ok);
        setPhase(count > 1 ? 'bulk' : 'reveal');
        return ok;
      } catch (e) {
        setPhase('idle');
        gachaTitleGrantedSuppress.active = false;
        throw e;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const draw = useCallback(
    (reducedMotion: boolean, payMode: GachaPayMode = 'auto') => run(reducedMotion, payMode, 1),
    [run],
  );

  const drawMany = useCallback(
    (reducedMotion: boolean, count: number, payMode: GachaPayMode = 'auto') =>
      run(reducedMotion, payMode, Math.max(1, count)),
    [run],
  );

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setResult(null);
    gachaTitleGrantedSuppress.active = false;
  }, []);

  const finishReveal = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);

  return { phase, result, busy, draw, drawMany, resetToIdle, finishReveal, setPhase };
}

export async function fetchGachaPool(): Promise<GachaPoolResponse> {
  const res = await fetch('/api/shop/gacha');
  if (!res.ok) throw new Error('pool fetch failed');
  return res.json() as Promise<GachaPoolResponse>;
}
