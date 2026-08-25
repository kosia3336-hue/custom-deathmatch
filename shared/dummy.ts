/** 랭크 더미 식별. 카카오/회원 행이 아닌 인메모리 상대 + 운영 더미 AI 스펙. */

import { GAME_IDS } from './types/game';

export const DEV_DUMMY_ID_PREFIX = 'dev-dummy:' as const;

export type DummyAiTier = '상' | '중' | '하';

/** 운영 더미 식별. 유니온으로 고정하지 않는다 — 로스터에 키를 추가하면 된다. */
export type LiveDummyKey = string;

export interface LiveDummyAiSpec {
  key: LiveDummyKey;
  nickname: string;
  defaultTier: DummyAiTier;
  tierOverrides: Partial<Record<string, DummyAiTier>>;
}

export const LIVE_DUMMY_AI: readonly LiveDummyAiSpec[] = [
  {
    key: 'titan',
    nickname: '타이탄',
    defaultTier: '상',
    tierOverrides: { [GAME_IDS.FOUR_GRAVITY]: '하' },
  },
  {
    key: 'yeonseung',
    nickname: '최연승',
    defaultTier: '중',
    tierOverrides: { [GAME_IDS.FOUR_GRAVITY]: '하' },
  },
  {
    key: 'jack',
    nickname: 'Jack',
    defaultTier: '상',
    tierOverrides: { [GAME_IDS.FOUR_GRAVITY]: '중' },
  },
  {
    key: 'ironhyunseong',
    nickname: '아이언현성',
    defaultTier: '중',
    tierOverrides: { [GAME_IDS.FOUR_GRAVITY]: '하' },
  },
];

export function getLiveDummyAi(nickname: string): LiveDummyAiSpec | undefined {
  return LIVE_DUMMY_AI.find((d) => d.nickname === nickname);
}

export function liveDummyTierFor(nickname: string, gameId: string): DummyAiTier {
  const spec = getLiveDummyAi(nickname);
  if (!spec) return '중';
  return spec.tierOverrides[gameId] ?? spec.defaultTier;
}

/** @deprecated 타이탄 전용. 새 코드는 LIVE_DUMMY_AI / liveDummyTierFor */
export const LIVE_DUMMY_NICKNAME = LIVE_DUMMY_AI[0]!.nickname;
export const LIVE_DUMMY_TIER: DummyAiTier = LIVE_DUMMY_AI[0]!.defaultTier;
export const LIVE_DUMMY_TIER_OVERRIDES: Readonly<Partial<Record<string, DummyAiTier>>> =
  LIVE_DUMMY_AI[0]!.tierOverrides;

export function liveDummyTierForGame(gameId: string): DummyAiTier {
  return liveDummyTierFor(LIVE_DUMMY_NICKNAME, gameId);
}

export function isDummyPlayerId(id: string): boolean {
  return id.startsWith(DEV_DUMMY_ID_PREFIX);
}

export function makeDummyPlayerId(): string {
  return `${DEV_DUMMY_ID_PREFIX}${crypto.randomUUID()}`;
}
