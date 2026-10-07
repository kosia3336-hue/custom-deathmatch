'use client';

import { useCallback, useState } from 'react';
import type { SBNWGameData, SBNWTile } from '@/shared/types/silper-bnw';
import { SBNW_INITIAL_TILES } from '@/shared/types/silper-bnw';
import {
  createSilperRoundNotes,
  initializeSilperRoundNotes,
  updateSilperTileNote,
  clearSilperTileNote,
  type SilperRoundNotes,
} from '@/lib/silperTileNotes';

/** View에서 관리해 기록 창/도킹/화면 너비 변경으로 개인 메모가 사라지지 않는다. */
export function useSilperTileNotes(data: SBNWGameData | undefined, opponentId: string | null) {
  const currentRound = data?.round ?? 1;
  const segment = data && opponentId ? `${data.rematchIndex}:${opponentId}` : null;
  const [stored, setStored] = useState<{
    segment: string | null;
    notes: SilperRoundNotes;
    pinnedRound: number | null;
  }>({ segment: null, notes: {}, pinnedRound: null });
  let state = stored;
  if (segment && data && opponentId && segment !== stored.segment) {
    state = {
      segment,
      notes: createSilperRoundNotes(currentRound, data.rematchIndex, data.roundHistory, opponentId),
      pinnedRound: null,
    };
  } else if (segment) {
    const notes = initializeSilperRoundNotes(stored.notes, currentRound);
    if (notes !== stored.notes) state = { ...stored, notes };
  }
  if (state !== stored) setStored(state);
  const round = Math.max(1, Math.min(state.pinnedRound ?? currentRound, currentRound));
  const selectRound = useCallback(
    (next: number) =>
      setStored((previous) => ({
        ...previous,
        pinnedRound: next === currentRound ? null : Math.max(1, Math.min(next, currentRound)),
      })),
    [currentRound],
  );
  const setNote = useCallback(
    (tile: SBNWTile, value: number) =>
      setStored((previous) => ({
        ...previous,
        notes: updateSilperTileNote(previous.notes, round, tile, value),
      })),
    [round],
  );
  const clearNote = useCallback(
    () =>
      setStored((previous) => ({ ...previous, notes: clearSilperTileNote(previous.notes, round) })),
    [round],
  );
  return {
    round,
    currentRound,
    note: state.notes[round] ?? SBNW_INITIAL_TILES,
    selectRound,
    setNote,
    clearNote,
  };
}
