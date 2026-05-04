export const WS_TOTAL_ROUNDS = 10;

export const CARD_TYPES = ['spade', 'diamond', 'heart', 'club', 'blackJoker', 'colorJoker'] as const;
export type WSCardType = typeof CARD_TYPES[number];

export type WSPhase = 'cardSelect' | 'reveal' | 'result' | 'finished';
export type WSWinType = 'streak' | 'wins' | 'draw' | 'timeout' | 'abandon' | 'stuck' | null;
export type WSMatchResult = 'win' | 'lose' | 'draw_lose' | 'draw_win';

export interface WSCardCount {
  spade: number;
  diamond: number;
  heart: number;
  club: number;
  blackJoker: number;
  colorJoker: number;
}

export const WS_INITIAL_CARDS: WSCardCount = {
  spade: 2,
  diamond: 2,
  heart: 2,
  club: 2,
  blackJoker: 1,
  colorJoker: 1,
};

export interface WSPlayerInfo {
  id: string;
  nickname: string;
  currentStreak: number;
  maxStreak: number;
  totalWins: number;
  remainingCards: WSCardCount;
  lastPlayedCard: WSCardType | null;
  submitted: boolean;
}

export interface WSRevealPlayerData {
  card: WSCardType;
  result: WSMatchResult;
  streakBefore: number;
  streakAfter: number;
  maxStreakBefore: number;
  maxStreakAfter: number;
  maxStreakUpdated: boolean;
  totalWinsAfter: number;
}

export interface WSRevealData {
  players: Record<string, WSRevealPlayerData>;
  matchDescription: string;
}

export interface WSRoundRecord {
  round: number;
  players: Record<string, {
    card: WSCardType;
    result: WSMatchResult;
    streakBefore: number;
    streakAfter: number;
    maxStreakAfter: number;
    totalWinsAfter: number;
  }>;
}

export interface WinningStreakGameData {
  round: number;
  phase: WSPhase;
  players: Record<string, WSPlayerInfo>;
  revealData: WSRevealData | null;
  roundHistory: WSRoundRecord[];
  winner: string | null;
  winType: WSWinType;
}

export type WinningStreakAction = { type: 'selectCard'; card: WSCardType };
