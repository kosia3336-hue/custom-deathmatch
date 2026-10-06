import { TILES_PER_ROUND, isNf4Number, type NF4Number } from './types/number4';

export interface NumberFourStock {
  remainingWhite: number;
  remainingBlack: number;
}
export function numberFourTileBounds(stock: NumberFourStock) {
  const minWhite = Math.max(0, TILES_PER_ROUND - stock.remainingBlack);
  const maxWhite = Math.min(TILES_PER_ROUND, stock.remainingWhite);
  return { minWhite, maxWhite, initialWhite: Math.max(minWhite, Math.min(4, maxWhite)) };
}
export type NumberFourSubmission = { white: number; black: number; number: NF4Number };
export type SubmissionCheck =
  | { ok: true; submission: NumberFourSubmission }
  | { ok: false; reason: 'type' | 'sum' | 'number' | 'stock' };
/** 브라우저는 안내용, 서버는 권한/단계 검사 후 최종 검증용으로 사용한다. */
export function validateNumberFourSubmission(
  white: unknown,
  black: unknown,
  number: unknown,
  stock: NumberFourStock,
): SubmissionCheck {
  if (
    typeof white !== 'number' ||
    typeof black !== 'number' ||
    !Number.isInteger(white) ||
    !Number.isInteger(black)
  )
    return { ok: false, reason: 'type' };
  if (white + black !== TILES_PER_ROUND) return { ok: false, reason: 'sum' };
  if (!isNf4Number(number)) return { ok: false, reason: 'number' };
  if (white < 0 || white > stock.remainingWhite || black < 0 || black > stock.remainingBlack)
    return { ok: false, reason: 'stock' };
  return { ok: true, submission: { white, black, number } };
}
