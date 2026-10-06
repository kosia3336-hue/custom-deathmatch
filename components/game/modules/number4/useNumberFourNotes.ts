'use client';
import { useCallback, useState } from 'react';
import {
  updateNumberFourNote,
  clearNumberFourNote,
  initializeNumberFourNotes,
  type NumberFourRoundNotes,
} from '@/lib/numberFourNotes';

/** 새 판의 View key로 초기화한다. 같은 판의 라운드/너비/재접속은 메모를 지우지 않는다. */
export function useNumberFourNotes(currentRound: number, playerIds: readonly string[]) {
  const [storedNotes, setNotes] = useState<NumberFourRoundNotes>(() =>
    initializeNumberFourNotes({}, currentRound, playerIds),
  );
  // 렌더 전에 새 라운드 메모를 준비해 최대치나 빈 입력이 한 프레임 끼지 않게 한다.
  const notes = initializeNumberFourNotes(storedNotes, currentRound, playerIds);
  if (notes !== storedNotes) setNotes(notes);
  const [pinnedRound, setPinnedRound] = useState<number | null>(null);
  const round = Math.min(pinnedRound ?? currentRound, currentRound);
  const selectRound = useCallback(
    (next: number) => setPinnedRound(next === currentRound ? null : next),
    [currentRound],
  );
  const setNote = useCallback(
    (id: string, color: 'white' | 'black', value: number) =>
      setNotes((prev) => updateNumberFourNote(prev, round, id, color, value)),
    [round],
  );
  const clearNote = useCallback(
    (id: string) => setNotes((prev) => clearNumberFourNote(prev, round, id)),
    [round],
  );
  return { notes, round, selectRound, setNote, clearNote };
}
