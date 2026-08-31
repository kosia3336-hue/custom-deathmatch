export interface Game {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  supportsMulti: boolean;
  supportsCom: boolean;
  supportsSolo: boolean;
  supportsTutorial: boolean;
  /** 랭킹 페이지 노출 + 랭크 매칭 밴픽 풀 포함 여부. false 면 새 게임을 검증 기간 동안
   *  캐주얼(비랭크) 방에서만 플레이하게 하고 랭크 큐에서는 제외할 수 있다. */
  rankingActive: boolean;
  /** 게임이 등록된 시각(ISO). 방 만들기에서 'NEW' 표시를 붙일지 판단한다.
   *  랜덤·밴픽처럼 실제 게임이 아닌 항목에는 없다. */
  createdAt?: string;
}

export const GAME_IDS = {
  FOUR_GRAVITY: 'game-001',
  DOUBLE_SIDED_CHESS: 'game-002',
  NUMBER_FOUR: 'game-003',
  INDIAN_POKER: 'game-004',
  INVEST_DONATE: 'game-005',
  BETTING_RPS: 'game-006',
  MULTIPLE_BNW: 'game-007',
  WINNING_STREAK: 'game-008',
  BNW2: 'game-009',
  SILPER_BNW: 'game-010',
  FIVE_TOWERS: 'game-011',
  GRAPE_SUGAR_2: 'game-012',
  SUN_MOON_STAR_2: 'game-013',
  BANK_GAME: 'game-014',
  INDIAN_POKER_EVENT: 'game-015',
  SUN_MOON_STAR_EVENT: 'game-016',
  QUATRO: 'game-017',
  WORD_PUZZLE: 'game-018',
  TRANSLETTER: 'game-019',
  FORMULA_COMPLETION: 'game-020',
  COMPLETE_HAP: 'game-021',
  KNIGHTS_TOUR: 'game-022',
  KINGMAKING: 'game-023',
  TRIPLE_GOMOKU: 'game-024',
  CHOICE_HOLDEM: 'game-025',
  RANDOM: 'random',
  BAN_PICK: 'ban-pick',
} as const;

/** 추상전략 COM에서 선택할 수 있는 AI 난이도. 보통이 이전 동작과 같은 기본값이다. */
export const ABSTRACT_AI_DIFFICULTIES = ['normal', 'hard'] as const;
export type AbstractAiDifficulty = (typeof ABSTRACT_AI_DIFFICULTIES)[number];
export const DEFAULT_ABSTRACT_AI_DIFFICULTY: AbstractAiDifficulty = 'normal';

export function resolveAbstractAiDifficulty(value: unknown): AbstractAiDifficulty {
  return value === 'hard' ? 'hard' : DEFAULT_ABSTRACT_AI_DIFFICULTY;
}

export function isAbstractStrategyGameId(gameId: string | null | undefined): boolean {
  return gameId === GAME_IDS.FOUR_GRAVITY || gameId === GAME_IDS.DOUBLE_SIDED_CHESS;
}
