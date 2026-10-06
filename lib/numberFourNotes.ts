import { INITIAL_WHITE, INITIAL_BLACK, TOTAL_ROUNDS } from '../shared/types/number4';

export interface NumberFourTileNote {
  white: number;
  black: number;
}
/** 사용자 개인의 잔여 타일 추정. 실제 게임 상태/서버 제출과 분리한다. */
export type NumberFourRoundNotes = Record<number, Record<string, NumberFourTileNote>>;

/** 새 라운드의 시작값만 복사한다. 과거 메모를 나중에 수정해도 다음 라운드는 바뀌지 않는다. */
export function initializeNumberFourNotes(
  notes: NumberFourRoundNotes,
  currentRound: number,
  playerIds: readonly string[],
): NumberFourRoundNotes {
  if (!Number.isInteger(currentRound) || currentRound < 1 || currentRound > TOTAL_ROUNDS)
    return notes;
  let next = notes;
  for (let round = 1; round <= currentRound; round++) {
    for (const playerId of playerIds) {
      if (next[round]?.[playerId]) continue;
      const previous = next[round - 1]?.[playerId] ?? {
        white: INITIAL_WHITE,
        black: INITIAL_BLACK,
      };
      next = {
        ...next,
        [round]: { ...next[round], [playerId]: { ...previous } },
      };
    }
  }
  return next;
}

export function updateNumberFourNote(
  notes: NumberFourRoundNotes,
  round: number,
  playerId: string,
  color: 'white' | 'black',
  value: number,
): NumberFourRoundNotes {
  if (!Number.isInteger(value) || !Number.isInteger(round) || round < 1 || round > TOTAL_ROUNDS)
    return notes;
  const initialized = initializeNumberFourNotes(notes, round, [playerId]);
  const previous = initialized[round][playerId];
  return {
    ...initialized,
    [round]: {
      ...initialized[round],
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
  if (!Number.isInteger(round) || round < 1 || round > TOTAL_ROUNDS) return notes;
  const previous = notes[round]?.[playerId];
  if (previous?.white === INITIAL_WHITE && previous.black === INITIAL_BLACK) return notes;
  return {
    ...notes,
    [round]: { ...notes[round], [playerId]: { white: INITIAL_WHITE, black: INITIAL_BLACK } },
  };
}
