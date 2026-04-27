export interface Game {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  supportsMulti: boolean;
  supportsCom: boolean;
  supportsSolo: boolean;
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
  RANDOM: 'random',
} as const;
