'use client';

import { useState } from 'react';
import {
  bnw2NoteStage,
  initializeBNW2PointNotes,
  updateBNW2PointNote,
  type BNW2PointNotes,
} from '@/lib/bnw2PointNotes';
import { BNW2_INITIAL_POINTS, bnw2StageRange, type BNW2GameData } from '@/shared/types/bnw2';

/** View가 소유해 단계·도킹·화면 크기 변경에도 메모를 유지한다. 새 경기만 초기화한다. */
export function useBNW2PointNotes(
  data: BNW2GameData | undefined,
  opponentId: string,
  gameKey: string,
) {
  const currentRound = data?.round ?? 1;
  const key = `${gameKey}:${opponentId}`;
  const [stored, setStored] = useState({
    key,
    notes: {} as BNW2PointNotes,
    pinnedRound: null as number | null,
  });
  const base = stored.key === key ? stored : { key, notes: {}, pinnedRound: null };
  const notes = initializeBNW2PointNotes(base.notes, currentRound);
  const state = notes === base.notes ? base : { ...base, notes };
  if (state !== stored) setStored(state);
  const round = Math.max(1, Math.min(state.pinnedRound ?? currentRound, currentRound));
  const stage = data ? bnw2NoteStage(data, opponentId, round) : 10;
  return {
    round,
    currentRound,
    stage,
    estimate: notes[round] ?? BNW2_INITIAL_POINTS,
    selectRound: (next: number) =>
      setStored((prev) => ({
        ...prev,
        pinnedRound: next === currentRound ? null : Math.max(1, Math.min(next, currentRound)),
      })),
    change: (value: number) =>
      setStored((prev) => ({
        ...prev,
        notes: updateBNW2PointNote(prev.notes, round, value, stage),
      })),
    reset: () =>
      setStored((prev) => ({
        ...prev,
        notes: updateBNW2PointNote(prev.notes, round, bnw2StageRange(stage).hi, stage),
      })),
  };
}
