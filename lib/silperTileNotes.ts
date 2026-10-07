import {
  SBNW_INITIAL_TILES,
  SBNW_TOTAL_ROUNDS,
  SBNW_TILES,
  type SBNWRoundRecord,
  type SBNWTile,
} from '../shared/types/silper-bnw';

export type SilperTileNote = Record<SBNWTile, number>;
export type SilperRoundNotes = Record<number, SilperTileNote>;

const validRound = (round: number) =>
  Number.isInteger(round) && round >= 1 && round <= SBNW_TOTAL_ROUNDS;

/** 중간 입장 초기값은 해당 라운드 이전에 공개된 타일만 반영한다. */
export function createSilperRoundNotes(
  currentRound: number,
  rematchIndex: number,
  history: readonly SBNWRoundRecord[],
  opponentId: string,
): SilperRoundNotes {
  if (!validRound(currentRound)) return {};
  const notes: SilperRoundNotes = {};
  for (let round = 1; round <= currentRound; round++) {
    const note = { ...SBNW_INITIAL_TILES };
    for (const record of history) {
      if (record.rematchIndex !== rematchIndex || record.round >= round) continue;
      for (const tile of record.players[opponentId]?.tilesUsed ?? []) {
        if (SBNW_TILES.includes(tile)) note[tile] = Math.max(0, note[tile] - 1);
      }
    }
    notes[round] = note;
  }
  return notes;
}

/** 새 라운드는 직전 메모의 복사본. 이후 과거 편집과 독립적으로 유지한다. */
export function initializeSilperRoundNotes(notes: SilperRoundNotes, currentRound: number) {
  if (!validRound(currentRound)) return notes;
  let next = notes;
  for (let round = 1; round <= currentRound; round++) {
    if (next[round]) continue;
    next = {
      ...next,
      [round]: { ...(next[round - 1] ?? SBNW_INITIAL_TILES) },
    };
  }
  return next;
}

export function updateSilperTileNote(
  notes: SilperRoundNotes,
  round: number,
  tile: SBNWTile,
  value: number,
) {
  if (!validRound(round) || !SBNW_TILES.includes(tile) || !Number.isInteger(value)) return notes;
  const initialized = initializeSilperRoundNotes(notes, round);
  return {
    ...initialized,
    [round]: {
      ...initialized[round],
      [tile]: Math.max(0, Math.min(SBNW_INITIAL_TILES[tile], value)),
    },
  };
}

export function clearSilperTileNote(notes: SilperRoundNotes, round: number) {
  if (!validRound(round)) return notes;
  return { ...notes, [round]: { ...SBNW_INITIAL_TILES } };
}
