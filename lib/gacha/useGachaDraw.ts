'use client';

import { useCallback, useState } from 'react';
import { gachaTitleGrantedSuppress } from './suppress-title-granted';
import type { GachaDrawResult, GachaPoolResponse } from './types';

export type GachaPhase = 'idle' | 'drawing' | 'reveal';

function minDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useGachaDraw() {
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [result, setResult] = useState<GachaDrawResult | null>(null);
  const [busy, setBusy] = useState(false);

  const draw = useCallback(async (reducedMotion: boolean): Promise<GachaDrawResult | null> => {
    if (busy) return null;
    setBusy(true);
    setPhase('drawing');
    setResult(null);
    gachaTitleGrantedSuppress.active = true;

    const minMs = reducedMotion ? 400 : 1500;

    try {
      const [res] = await Promise.all([
        fetch('/api/shop/gacha/draw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gachaId: 'default' }),
        }),
        minDelay(minMs),
      ]);

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setPhase('idle');
        gachaTitleGrantedSuppress.active = false;
        throw Object.assign(new Error(json.error ?? 'draw failed'), { code: json.code });
      }

      const ok = json as GachaDrawResult;
      setResult(ok);
      setPhase('reveal');
      return ok;
    } catch (e) {
      setPhase('idle');
      gachaTitleGrantedSuppress.active = false;
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setResult(null);
    gachaTitleGrantedSuppress.active = false;
  }, []);

  const finishReveal = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);

  return { phase, result, busy, draw, resetToIdle, finishReveal, setPhase };
}

export async function fetchGachaPool(): Promise<GachaPoolResponse> {
  const res = await fetch('/api/shop/gacha');
  if (!res.ok) throw new Error('pool fetch failed');
  return res.json() as Promise<GachaPoolResponse>;
}
