'use client';

import { useEffect, useRef } from 'react';
import { playFileSound, stopFileAudio, unlockFileAudio } from '@/lib/audio/player';
import { pokerAudioEvents, type PokerAudioSnapshot } from '@/lib/audio/feedback';
import { getSocket } from '@/lib/socket';

/** One lifecycle for game samples; closing the game cancels late network playback. */
export function useGameAudio() {
  useEffect(() => {
    const unlock = () => { void unlockFileAudio(); };
    const hide = () => { if (document.hidden) stopFileAudio(); };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', hide);
      stopFileAudio();
    };
  }, []);
}

export function useCardRevealSound(shown: boolean, face = 'front') {
  const previous = useRef<{ shown: boolean; face: string } | null>(null);
  useEffect(() => {
    const last = previous.current;
    previous.current = { shown, face };
    if (last && shown && (!last.shown || last.face !== face)) playFileSound('cardFlip');
  }, [shown, face]);
}

export function usePokerAudio(snapshot: PokerAudioSnapshot | null) {
  const previous = useRef<PokerAudioSnapshot | null>(null);
  useEffect(() => {
    const reset = () => { previous.current = null; };
    const socket = getSocket();
    socket.on('disconnect', reset);
    document.addEventListener('visibilitychange', reset);
    return () => { socket.off('disconnect', reset); document.removeEventListener('visibilitychange', reset); };
  }, []);
  // Depend on scalar state, so unrelated chat/profile updates do not replay feedback.
  const signature = snapshot ? JSON.stringify(snapshot) : null;
  useEffect(() => {
    const next = signature ? JSON.parse(signature) as PokerAudioSnapshot : null;
    const last = previous.current;
    previous.current = next;
    if (!next || document.hidden) return;
    pokerAudioEvents(last, next).forEach(cue => playFileSound(cue));
  }, [signature]);
}
