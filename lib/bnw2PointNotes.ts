import { BNW2_INITIAL_POINTS, bnw2StageRange, type BNW2GameData } from '../shared/types/bnw2';

/** 상대 비공개 포인트 대신 사용자가 입력한 추정값만 라운드별로 보관한다. */
export type BNW2PointNotes = Record<number, number>;

export function initializeBNW2PointNotes(notes: BNW2PointNotes, currentRound: number) {
  if (!Number.isInteger(currentRound) || currentRound < 1) return notes;
  let next = notes;
  for (let round = 1; round <= currentRound; round++) {
    if (next[round] !== undefined) continue;
    next = { ...next, [round]: next[round - 1] ?? BNW2_INITIAL_POINTS };
  }
  return next;
}

export function updateBNW2PointNote(
  notes: BNW2PointNotes,
  round: number,
  value: number,
  stage: number,
) {
  if (!Number.isInteger(round) || round < 1 || !Number.isFinite(value)) return notes;
  const { lo, hi } = bnw2StageRange(stage);
  return { ...notes, [round]: Math.max(lo, Math.min(hi, Math.floor(value))) };
}

/** 지난 라운드의 공개된 잔여 단계로 편집 범위를 정한다. */
export function bnw2NoteStage(data: BNW2GameData, opponentId: string, round: number) {
  if (round === data.round) return data.players[opponentId]?.stage ?? 10;
  return (
    data.roundHistory.find((record) => record.round === round)?.players[opponentId]?.stageAfter ??
    10
  );
}
