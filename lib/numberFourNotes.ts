import { INITIAL_WHITE, INITIAL_BLACK, TOTAL_ROUNDS } from '../shared/types/number4';

export interface NumberFourTileNote {
  white: number;
  black: number;
}
/** 사용자 개인의 잔여 타일 추정. 실제 게임 상태/서버 제출과 분리한다. */
export type NumberFourRoundNotes = Record<number, Record<string, NumberFourTileNote>>;

export function updateNumberFourNote(
  notes: NumberFourRoundNotes,
  round: number,
  playerId: string,
  color: 'white' | 'black',
  value: number,
): NumberFourRoundNotes {
  if (!Number.isInteger(value) || !Number.isInteger(round) || round < 1 || round > TOTAL_ROUNDS)
    return notes;
  const previous = notes[round]?.[playerId] ?? { white: INITIAL_WHITE, black: INITIAL_BLACK };
  return {
    ...notes,
    [round]: {
      ...notes[round],
      [playerId]: {
        ...previous,
        [color]: Math.max(0, Math.min(color === 'white' ? INITIAL_WHITE : INITIAL_BLACK, value)),
      },
    },
  };
}

export function clearNumberFourNote(
  notes: NumberFourRoundNotes,
  round: number,
  playerId: string,
): NumberFourRoundNotes {
  if (!notes[round]?.[playerId]) return notes;
  const entries = { ...notes[round] };
  delete entries[playerId];
  const next = { ...notes };
  if (Object.keys(entries).length) next[round] = entries;
  else delete next[round];
  return next;
}
