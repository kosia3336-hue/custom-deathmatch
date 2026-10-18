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

/**
 * 메모로 고를 수 있는 상대 잔여 범위.
 * 표시등 맨 아래 칸은 0 과 1~20 을 똑같이 보여 주므로(서버도 0 을 1 칸으로 보낸다) 0~20 이다.
 */
export function bnw2NoteRange(stage: number) {
  return stage <= 1 ? { lo: 0, hi: bnw2StageRange(1).hi } : bnw2StageRange(stage);
}

export function updateBNW2PointNote(
  notes: BNW2PointNotes,
  round: number,
  value: number,
  stage: number,
) {
  if (!Number.isInteger(round) || round < 1 || !Number.isFinite(value)) return notes;
  const { lo, hi } = bnw2NoteRange(stage);
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
