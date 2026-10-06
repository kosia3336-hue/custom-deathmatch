'use client';
import { useEffect, useRef } from 'react';
import type { BRPSResult, BRPSBetOutcome } from '@/shared/types/betting-rps';
import { DREAMSHOP_SOUND_IDS, dreamshopRevealSounds } from '@/lib/audio/skins/dreamshop';
import { playFileSound, unlockFileAudio } from '@/lib/audio/player';

export function useDreamshopAudio(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      void unlockFileAudio(DREAMSHOP_SOUND_IDS);
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [enabled]);
}
export function useDreamshopRevealSound(
  enabled: boolean,
  step: number,
  result: BRPSResult | null,
  outcome: BRPSBetOutcome | null,
) {
  const previous = useRef({ enabled, step });
  useEffect(() => {
    const last = previous.current;
    previous.current = { enabled, step };
    if (!enabled || !last.enabled || document.hidden) return;
    dreamshopRevealSounds(last.step, step, result, outcome).forEach((sound) =>
      playFileSound(sound),
    );
  }, [enabled, step, result, outcome]);
}
