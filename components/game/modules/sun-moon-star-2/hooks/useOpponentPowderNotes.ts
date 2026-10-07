import { useState } from 'react';
import type { SMS2GameData, SMS2MarkId, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { powderStageRange } from '@/shared/types/sun-moon-star-2';
import {
  powderStagesForRound,
  readPowderRoundNote,
  updatePowderRoundNote,
  type PowderRoundNotes,
} from '@/lib/sunMoonStarNotes';

/** 라운드 메모를 서버 단계 변경 및 도킹 창 재배치와 분리해서 보존한다. */
export function useOpponentPowderNotes(
  data: SMS2GameData | undefined,
  side: SMS2Side,
  gameKey: string,
) {
  const latest = data?.round ?? 1;
  const [state, setState] = useState({
    key: gameKey,
    latest,
    round: latest,
    notes: {} as PowderRoundNotes,
  });
  let current = state;
  if (state.key !== gameKey || state.latest !== latest) {
    current =
      state.key !== gameKey
        ? { key: gameKey, latest, round: latest, notes: {} }
        : {
            ...state,
            latest,
            round: state.round === state.latest ? latest : Math.min(state.round, latest),
          };
    setState(current);
  }
  const stages = data
    ? powderStagesForRound(data, side, current.round)
    : { before: 5 as const, after: 5 as const };
  const max = powderStageRange(stages.before).max;
  return {
    round: current.round,
    latest,
    estimate: {
      perMark: readPowderRoundNote(current.notes, current.round),
      basedOnStagePrev: stages.before,
      basedOnStageNow: stages.after,
    },
    max,
    selectRound: (round: number) =>
      setState((prev) => ({ ...prev, round: Math.max(1, Math.min(latest, round)) })),
    change: (mark: SMS2MarkId, value: number) =>
      setState((prev) => ({
        ...prev,
        notes: updatePowderRoundNote(prev.notes, prev.round, mark, value, max),
      })),
    reset: () =>
      setState((prev) => ({
        ...prev,
        notes: { ...prev.notes, [prev.round]: { sun: 0, moon: 0, star: 0 } },
      })),
  };
}
