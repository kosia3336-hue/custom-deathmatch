import type { PlayMode } from './room';

export const SEED_SEOTDA_INITIAL_CHIPS = 20;
export const SEED_SEOTDA_ANTE = 1;

export type SeedSeotdaMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SeedSeotdaCardVariant = 'a' | 'b';
export type SeedSeotdaCardKind = 'bright' | 'animal' | 'ribbon';

export interface SeedSeotdaCard {
  id: string;
  month: SeedSeotdaMonth;
  variant: SeedSeotdaCardVariant;
  kind: SeedSeotdaCardKind;
}

export type SeedSeotdaPhase = 'seed-choice' | 'betting' | 'round-result' | 'finished';
export type SeedSeotdaSeedChoice = 'pending' | 'used' | 'unused';
export type SeedSeotdaHandKind =
  | '38-gwang-ddaeng'
  | 'gwang-ddaeng'
  | 'ddaeng'
  | 'ali'
  | 'doksa'
  | 'guping'
  | 'jangping'
  | 'jangsa'
  | 'seryuk'
  | 'gapoh'
  | 'kkeut'
  | 'mangtong'
  | 'amhaeng-eosa'
  | 'ddaeng-jabi'
  | 'gusa'
  | 'mung-gusa';

export interface SeedSeotdaEvaluation {
  kind: SeedSeotdaHandKind;
  name: string;
  strength: number;
  pairMonth: SeedSeotdaMonth | null;
  point: number | null;
}

export type SeedSeotdaAction =
  | { type: 'use-seed'; discardIndex: 0 | 1 }
  | { type: 'skip-seed' }
  | { type: 'bet'; amount: number }
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'die' };

export interface SeedSeotdaBettingAction {
  round: number;
  playerId: string;
  action: 'bet' | 'call' | 'raise' | 'die';
  amount: number;
  totalBet: number;
}

export interface SeedSeotdaPlayerView {
  id: string;
  nickname: string;
  chips: number;
  roundBet: number;
  cards: Array<SeedSeotdaCard | null>;
  finalHand: Array<SeedSeotdaCard | null>;
  seedChoice: SeedSeotdaSeedChoice;
  evaluation: SeedSeotdaEvaluation | null;
}

export type SeedSeotdaRoundReason =
  | 'showdown'
  | 'die'
  | 'tie'
  | 'gusa-rematch'
  | 'mung-gusa-rematch';

export interface SeedSeotdaRoundResult {
  round: number;
  winnerId: string | null;
  reason: SeedSeotdaRoundReason;
  foldedPlayerId: string | null;
  potAmount: number;
  carryRound: boolean;
  seedCard: SeedSeotdaCard;
  hands: Record<string, SeedSeotdaCard[] | null>;
  evaluations: Record<string, SeedSeotdaEvaluation | null>;
  seedChoices: Record<string, Exclude<SeedSeotdaSeedChoice, 'pending'>>;
  diePenalty: number;
  chipCountsAfter: Record<string, number>;
  actions: SeedSeotdaBettingAction[];
  deckRemainingAfter: number;
  /**
   * 이 라운드가 몇 번째 덱에서 나왔는지.
   *
   * 덱은 다섯 장 밑으로 떨어지면 새로 섞는다. 카운팅은 '지금 덱에 무엇이 남았나' 를
   * 보는 것이라, 지난 덱에서 나온 패까지 세면 스무 장이 다 차서 못 쓰게 된다.
   */
  deckCycle: number;
}

export interface SeedSeotdaGameData {
  phase: SeedSeotdaPhase;
  playMode: PlayMode;
  round: number;
  ante: number;
  carryRound: boolean;
  players: Record<string, SeedSeotdaPlayerView>;
  seedCard: SeedSeotdaCard | null;
  pot: number;
  deckRemaining: number;
  /** 지금까지 덱을 몇 번 썼는지(1부터). 새로 섞일 때마다 하나씩 오른다. */
  deckCycles: number;
  currentTurnId: string | null;
  firstPlayerId: string;
  bettingOpened: boolean;
  currentBet: number;
  toCall: number;
  minBet: number | null;
  maxBet: number | null;
  minRaise: number | null;
  maxRaise: number | null;
  /**
   * 끝난 라운드 전체 기록 — 메모탭의 '기록' 에서 되짚는 데 쓴다.
   *
   * 기록에 담기는 패는 이미 '공개된 것' 뿐이다. 다이로 끝난 라운드는 던진 사람 패만
   * 들어가고 이긴 사람 패는 null 이며(engine.ts settleDie), 승부까지 간 라운드만
   * 둘 다 들어간다. 그래서 따로 가릴 것 없이 그대로 내보낸다.
   */
  rounds: SeedSeotdaRoundResult[];
  lastRoundResult: SeedSeotdaRoundResult | null;
  roundStartedAt: number;
  turnStartedAt: number | null;
  turnSeconds: number | null;
  winnerId: string | null;
  finishReason: string | null;
}

export interface SeedSeotdaArchiveRecord {
  rounds: SeedSeotdaRoundResult[];
  finalChips: Record<string, number>;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
  totalRounds: number;
  deckCycles: number;
}
