import type {
  SMS2GameData,
  SMS2MarkId,
  SMS2PowderStage,
  SMS2Side,
} from '../shared/types/sun-moon-star-2';
export type PowderRoundNotes = Record<number, Record<SMS2MarkId, number>>;

export function readPowderRoundNote(
  notes: PowderRoundNotes,
  round: number,
): Record<SMS2MarkId, number> {
  return notes[round] ?? { sun: 0, moon: 0, star: 0 };
}

export function updatePowderRoundNote(
  notes: PowderRoundNotes,
  round: number,
  mark: SMS2MarkId,
  value: number,
  max = 100,
): PowderRoundNotes {
  const next = Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  return { ...notes, [round]: { ...readPowderRoundNote(notes, round), [mark]: next } };
}

/** 공개된 단계만 사용한다. 과거 분배값이나 상대 비공개 데이터를 추리값에 복사하지 않는다. */
export function powderStagesForRound(
  data: SMS2GameData,
  side: SMS2Side,
  round: number,
): { before: SMS2PowderStage; after: SMS2PowderStage } {
  const record = data.history.find((r) => r.round === round);
  if (record) return { before: record.stageBefore[side], after: record.stageAfter[side] };
  const previous = data.history.filter((r) => r.round < round).sort((a, b) => b.round - a.round)[0];
  const before = previous?.stageAfter[side] ?? 5;
  return { before, after: round === data.round ? data.players[side].powderStage : before };
}
