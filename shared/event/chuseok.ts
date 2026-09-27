/**
 * 2026 한가위. 9월 27일 21:00 KST ~ 10월 12일 01:00 KST.
 * 랭크만 송편을 준다. 승 3, 무 2, 패 1, 기권패 0.
 */

export const CHUSEOK_2026_START_MS = Date.parse('2026-09-27T21:00:00+09:00');
export const CHUSEOK_2026_END_MS = Date.parse('2026-10-12T01:00:00+09:00');

export const CHUSEOK_SONGPYEON = {
  win: 3,
  draw: 2,
  loss: 1,
  forfeit: 0,
} as const;

export function isChuseok2026Open(now = Date.now()): boolean {
  return now >= CHUSEOK_2026_START_MS && now < CHUSEOK_2026_END_MS;
}

/** 상점 한정. 뽑기 풀에 넣지 않는다. */
export const CHUSEOK_LIMITED_SKIN_ID = 'skin-g013-chuseok';

/** 스킨 영구 선택권·랜덤권 대상. 한정 스킨(해달별2)은 넣지 않는다. db/chuseok_2026.sql 풀과 같다. */
export const CHUSEOK_SKIN_TICKET_POOL = [
  'skin-g003-01',
  'skin-g001-01',
  'skin-g002-01',
  'skin-g004-01',
  'skin-g010-01',
  'skin-g012-01',
  'skin-g014-01',
  'skin-g017-01',
  'skin-g011-01',
  'skin-g009-01',
  'skin-g023-01',
  'skin-g007-01',
] as const;

export function songpyeonForRankedResult(input: {
  outcome: 'win' | 'loss' | 'draw';
  forfeit: boolean;
}): number {
  if (input.forfeit && input.outcome === 'loss') return CHUSEOK_SONGPYEON.forfeit;
  if (input.outcome === 'win') return CHUSEOK_SONGPYEON.win;
  if (input.outcome === 'draw') return CHUSEOK_SONGPYEON.draw;
  return CHUSEOK_SONGPYEON.loss;
}
