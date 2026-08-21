/** 랭크 더미 식별. 카카오/회원 행이 아닌 인메모리 상대. */

export const DEV_DUMMY_ID_PREFIX = 'dev-dummy:' as const;

export type DummyAiTier = '상' | '중' | '하';

export function isDummyPlayerId(id: string): boolean {
  return id.startsWith(DEV_DUMMY_ID_PREFIX);
}

export function makeDummyPlayerId(): string {
  return `${DEV_DUMMY_ID_PREFIX}${crypto.randomUUID()}`;
}
