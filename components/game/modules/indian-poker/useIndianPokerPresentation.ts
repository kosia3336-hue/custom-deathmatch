'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { IndianPokerGameData } from '@/shared/types/indian-poker';
import type { SkinTheme } from '@/lib/skins/registry';
import { getSocket } from '@/lib/socket';
import { playChipsSfx } from '@/lib/audio/chips';
import { usePokerAudio } from '@/hooks/useGameAudio';
import { useNocturneDealReveal } from './skins/useNocturneDealReveal';
import { WIN_TYPE_LABELS } from './constants';

export function useIndianPokerPresentation(
  data: IndianPokerGameData,
  myId: string,
  skin?: SkinTheme | null,
) {
  const [shuffle, setShuffle] = useState({
    cycle: data.deckCycle,
    ante: data.ante,
    visible: false,
  });
  if (shuffle.cycle !== data.deckCycle)
    setShuffle({
      cycle: data.deckCycle,
      ante: data.ante,
      visible: data.deckCycle > shuffle.cycle,
    });
  const previous = useRef<{ round: number; phase: string; winner: string | null } | null>(null);
  const shown = useRef(new Set<string>());
  useEffect(() => {
    const reset = () => {
      previous.current = null;
      setShuffle((value) => ({ ...value, visible: false }));
    };
    const socket = getSocket();
    socket.on('disconnect', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      socket.off('disconnect', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, []);
  useEffect(() => {
    const last = previous.current;
    previous.current = { round: data.round, phase: data.phase, winner: data.winner };
    // 처음 수신/재접속과 복원된 결과에는 이미 지난 연출을 재생하지 않는다.
    if (!last || document.hidden || data.round < last.round) return;
    if (
      ['showdown', 'dieResult'].includes(data.phase) &&
      (last.phase !== data.phase || last.round !== data.round)
    ) {
      const key = `result:${data.round}`;
      if (!shown.current.has(key)) {
        shown.current.add(key);
        playChipsSfx();
      }
    }
    if (data.winner && data.winType && last.winner !== data.winner) {
      const key = `winner:${data.winner}`;
      if (!shown.current.has(key)) {
        shown.current.add(key);
        const message = `${data.players[data.winner]?.nickname ?? '플레이어'} 승리! ${WIN_TYPE_LABELS[data.winType]}`;
        if (data.winner === myId) toast.success(message, { duration: 5000 });
        else toast.error(message, { duration: 5000 });
      }
    }
  }, [data.round, data.phase, data.winner, data.winType, data.players, myId]);
  useEffect(() => {
    if (!shuffle.visible) return;
    const timer = setTimeout(() => setShuffle((value) => ({ ...value, visible: false })), 2800);
    return () => clearTimeout(timer);
  }, [shuffle.visible, shuffle.cycle]);
  usePokerAudio({
    round: data.round,
    phase: data.phase,
    pot: data.pot,
    turnId: data.currentTurnId,
    myId,
    isPlayer: Boolean(data.players[myId]),
    skinHandlesBetting: skin === 'nocturne',
  });
  const { dealStep } = useNocturneDealReveal({
    enabled: skin === 'nocturne',
    round: data.round,
    phase: data.phase,
    blockAnim: shuffle.visible,
  });
  return { showShuffle: shuffle.visible, shuffleAnte: shuffle.ante, dealStep };
}

/** 종속 상태를 effect에서 즉시 초기화하지 않고, 입력이 바뀌는 순간 화면에서 숨긴다. */
export function useDelayedCardReveal(enabled: boolean, identity: string | number, delay = 300) {
  const [revealed, setRevealed] = useState<string | number | null>(null);
  const [epoch, setEpoch] = useState({ enabled, identity, key: 0 });
  if (epoch.enabled !== enabled || epoch.identity !== identity) {
    setEpoch({ enabled, identity, key: epoch.key + 1 });
  }
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setRevealed(epoch.key), delay);
    return () => clearTimeout(timer);
  }, [enabled, epoch.key, delay]);
  return enabled && revealed === epoch.key;
}

export function useResultReveal(identity: string) {
  const [reveal, setReveal] = useState({ identity, step: 0 });
  if (reveal.identity !== identity) setReveal({ identity, step: 0 });
  useEffect(() => {
    const first = setTimeout(() => setReveal({ identity, step: 1 }), 200);
    const second = setTimeout(() => setReveal({ identity, step: 2 }), 700);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [identity]);
  return reveal.step;
}
