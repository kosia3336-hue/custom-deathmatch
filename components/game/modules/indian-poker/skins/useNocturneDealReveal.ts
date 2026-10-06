'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useSkinFx } from '@/lib/skins/useSkinFx';
import { sfxDealSequence } from '@/lib/audio/skins/nocturne';

export const NOCTURNE_DEAL_PREP_MS = 220;
export const NOCTURNE_DEAL_STEP_MS = 170;
const STEPS = 4;

/** 무월 스킨 — 라운드당 4장 순차 공개 (0=없음, 4=전부) */
export function useNocturneDealReveal(opts: {
  enabled: boolean;
  round: number;
  phase: string;
  blockAnim: boolean;
}): { dealStep: number } {
  const { enabled, round, phase, blockAnim } = opts;
  const { reducedMotion } = useSkinFx();
  const [dealStep, setDealStep] = useState(STEPS);
  const prevRoundRef = useRef<number | null>(null);
  const animatedRoundsRef = useRef<Set<number>>(new Set());
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  useLayoutEffect(() => {
    clearTimers();
    if (!enabled) {
      setDealStep(STEPS);
      return;
    }
    if (phase !== 'betting' && phase !== 'dealing') {
      setDealStep(STEPS);
      return;
    }
    if (blockAnim) {
      // 셔플 중에 라운드가 바뀌면 미리 등록 — 셔플 끝났을 때 딜 애니메이션 건너뜀
      if (prevRoundRef.current !== null && prevRoundRef.current !== round) {
        animatedRoundsRef.current.add(round);
        prevRoundRef.current = round;
      }
      return;
    }

    if (animatedRoundsRef.current.has(round)) {
      setDealStep(STEPS);
      return;
    }

    if (prevRoundRef.current === null && round > 1) {
      animatedRoundsRef.current.add(round);
      prevRoundRef.current = round;
      setDealStep(STEPS);
      return;
    }

    if (prevRoundRef.current === round) return;
    prevRoundRef.current = round;
    animatedRoundsRef.current.add(round);

    if (reducedMotion) {
      setDealStep(STEPS);
      return;
    }

    setDealStep(0);
    timersRef.current.push(...sfxDealSequence(STEPS, NOCTURNE_DEAL_STEP_MS, NOCTURNE_DEAL_PREP_MS));

    for (let s = 1; s <= STEPS; s++) {
      const t = window.setTimeout(
        () => setDealStep(s),
        NOCTURNE_DEAL_PREP_MS + s * NOCTURNE_DEAL_STEP_MS,
      );
      timersRef.current.push(t);
    }

    return clearTimers;
  }, [enabled, round, phase, blockAnim, reducedMotion]);

  return { dealStep };
}
