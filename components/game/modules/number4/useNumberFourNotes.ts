'use client';
import { useCallback, useState } from 'react';
import {
  updateNumberFourNote,
  clearNumberFourNote,
  type NumberFourRoundNotes,
} from '@/lib/numberFourNotes';

/** 새 판의 View key로 초기화한다. 같은 판의 라운드/너비/재접속은 메모를 지우지 않는다. */
export function useNumberFourNotes(currentRound: number) {
  const [notes, setNotes] = useState<NumberFourRoundNotes>({});
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
