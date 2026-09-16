import type { PlayMode } from './room';

export const CHOICE_HOLDEM_INITIAL_CHIPS = 20;
export const CHOICE_HOLDEM_ANTE_INTERVAL = 10;

export type ChoiceHoldemCard = 1 | 2 | 3 | 4 | 5;
export type ChoiceHoldemPhase =
  | 'first-betting'
  | 'arranging-choice'
  | 'choosing-card'
  | 'second-betting'
  | 'round-result'
  | 'finished';
export type ChoiceHoldemBettingPhase = 'first' | 'second';
export type ChoiceHoldemHandCategory =
  | 'high-card'
  | 'one-pair'
  | 'two-pair'
  | 'triple'
  | 'straight'
  | 'full-house'
  | 'four-kind';

export interface ChoiceHoldemEvaluation {
  category: ChoiceHoldemHandCategory;
  primaryValues: number[];
  privateKickers: number[];
}

export type ChoiceHoldemAction =
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'fold' }
  | { type: 'arrange-choice'; faceUpIndex: 0 | 1 }
  | { type: 'pick-choice'; choice: 'face-up' | 'face-down' };

export interface ChoiceHoldemBettingAction {
  round: number;
  phase: ChoiceHoldemBettingPhase;
  playerId: string;
  action: 'call' | 'raise' | 'fold';
  amount: number;
  totalBet: number;
}

export interface ChoiceHoldemRoundResult {
  round: number;
  winnerId: string | null;
  reason: 'showdown' | 'fold' | 'tie';
  foldedPlayerId: string | null;
  potAmount: number;
  ante: number;
  carryRound: boolean;
  communityCards: ChoiceHoldemCard[];
  holeCards: Record<string, ChoiceHoldemCard[]> | null;
  evaluations: Record<string, ChoiceHoldemEvaluation> | null;
  choiceFaceUp: ChoiceHoldemCard | null;
  choiceFaceUpOwnerId: string | null;
  chipCountsAfter: Record<string, number>;
  actions: ChoiceHoldemBettingAction[];
}

export interface ChoiceHoldemPlayerView {
  id: string;
  nickname: string;
  chips: number;
  roundBet: number;
  cards: Array<ChoiceHoldemCard | null>;
}

export interface ChoiceHoldemChoiceView {
  options: Array<ChoiceHoldemCard | null> | null;
  arranged: boolean;
  faceUp: ChoiceHoldemCard | null;
  faceDown: ChoiceHoldemCard | null;
  faceUpOwnerId: string | null;
  faceDownOwnerId: string | null;
}

export interface ChoiceHoldemGameData {
  phase: ChoiceHoldemPhase;
  playMode: PlayMode;
  round: number;
  ante: number;
  carryRound: boolean;
  players: Record<string, ChoiceHoldemPlayerView>;
  communityCards: ChoiceHoldemCard[];
  pot: number;
  currentTurnId: string | null;
  firstPlayerId: string;
  selectorId: string;
  currentBet: number;
  toCall: number;
  minRaise: number | null;
  maxRaise: number | null;
  choice: ChoiceHoldemChoiceView;
  /**
   * 끝난 라운드 전체 기록 — 화면의 '기록'에서 내가 얼마를 걸었고 누가 무슨 패로
   * 이겼는지 되짚는 데 쓴다. 폴드로 끝난 라운드는 패가 없으므로 holeCards 가 null 이라,
   * 공개된 적 없는 패가 여기로 새지 않는다.
   */
  rounds: ChoiceHoldemRoundResult[];
  lastRoundResult: ChoiceHoldemRoundResult | null;
  roundStartedAt: number;
  turnStartedAt: number | null;
  turnSeconds: number | null;
  winnerId: string | null;
  finishReason: string | null;
}

export interface ChoiceHoldemArchiveRecord {
  rounds: ChoiceHoldemRoundResult[];
  finalChips: Record<string, number>;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
  totalRounds: number;
}
