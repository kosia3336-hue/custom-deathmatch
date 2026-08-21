import { GAME_IDS } from '@shared/types/game.js';
import type { DummyAiTier } from '@shared/dummy.js';

/** 더미가 끝까지 둘 수 있는 게임. 나머지는 밴픽 후 바로 종료. */
export const DUMMY_IMPLEMENTED_GAME_IDS: ReadonlySet<string> = new Set([
  GAME_IDS.FOUR_GRAVITY,
  GAME_IDS.DOUBLE_SIDED_CHESS,
  GAME_IDS.NUMBER_FOUR,
  GAME_IDS.INDIAN_POKER,
  GAME_IDS.INVEST_DONATE,
  GAME_IDS.BETTING_RPS,
  GAME_IDS.MULTIPLE_BNW,
  GAME_IDS.WINNING_STREAK,
  GAME_IDS.BNW2,
  GAME_IDS.SILPER_BNW,
  GAME_IDS.FIVE_TOWERS,
  GAME_IDS.GRAPE_SUGAR_2,
  GAME_IDS.SUN_MOON_STAR_2,
  GAME_IDS.BANK_GAME,
  GAME_IDS.QUATRO,
]);


export function isDummyGameImplemented(gameId: string): boolean {
  return DUMMY_IMPLEMENTED_GAME_IDS.has(gameId);
}

export type { DummyAiTier };
