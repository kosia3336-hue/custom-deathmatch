export const TILES_PER_ROUND = 7;
export const TOTAL_ROUNDS = 6;
export const NF4_REVEAL_DELAY_MS = 5000;
export const INITIAL_SCORE = 3;
export const INITIAL_WHITE = 22;
export const INITIAL_BLACK = 20;

/** 성공 시 넘버별 승점. 실패는 항상 -1. */
export const NF4_REWARDS: readonly [5, 1, 2, 3, 4] = [5, 1, 2, 3, 4];

export type NF4Phase = 'submit' | 'reveal' | 'finished';
export type NF4WinType = 'score' | 'elimination' | 'tiebreaker' | 'timeout' | 'draw';
export type NF4Number = 0 | 1 | 2 | 3 | 4;

export function isNf4Number(n: unknown): n is NF4Number {
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4;
}

export function nf4ScoreDelta(number: NF4Number, success: boolean): number {
  return success ? NF4_REWARDS[number] : -1;
}

export function nf4ApplyScore(score: number, number: NF4Number, success: boolean): number {
  return Math.max(0, score + nf4ScoreDelta(number, success));
}

/** 슈퍼 AI 자문. 내 타일·넘버는 알고, 상대 타일은 없다. 성공/실패는 이용자가 넣는다. */
export interface Nf4AdvisorRound {
  myWhite?: number;
  myBlack?: number;
  myNumber: NF4Number;
  oppNumber: NF4Number;
  mySuccess: boolean;
  oppSuccess: boolean;
}

export type Nf4AdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'ask-winner'; reason: string };

export interface Nf4AdvisorSnapshot {
  myScore: number;
  oppScore: number;
  myNumberSum: number;
  oppNumberSum: number;
  myWhiteLeft: number;
  myBlackLeft: number;
  tilesKnown: boolean;
  /** 다음에 둘 라운드(1~6). 끝나면 7. */
  round: number;
  result: Nf4AdvisorResult;
}

export interface NF4PlayerInfo {
  id: string;
  nickname: string;
  score: number;
  remainingWhite: number;
  remainingBlack: number;
  submitted: boolean;
  /** 본인에게만 전송하는 현재 라운드 제출 내용. */
  submission?: { white: number; black: number; number: NF4Number };
}

export interface NF4RevealPlayerData {
  number: NF4Number;
  success: boolean;
  scoreChange: number;
  conditionDetail: string;
}

export interface NF4RevealData {
  players: Record<string, NF4RevealPlayerData>;
}

export interface NF4RoundRecord {
  round: number;
  players: Record<
    string,
    {
      number: NF4Number;
      success: boolean;
      scoreChange: number;
      scoreAfter: number;
      /** 본인 기록에만 포함된다. 상대/관전자에게는 생략한다. */
      white?: number;
      black?: number;
    }
  >;
}

export interface NF4TutorialHint {
  step: 'intro' | 'choose' | 'result' | 'summary';
  title: string;
  body: string;
  expectedWhite?: number;
  expectedNumber?: NF4Number;
  ackLabel?: string;
}

export interface NumberFourGameData {
  tutorial?: NF4TutorialHint;
  round: number;
  phase: NF4Phase;
  /** 서버 기준 결과 공개 종료 시각. 튜토리얼은 자동 전환하지 않는다. */
  revealEndsAt?: number;
  players: Record<string, NF4PlayerInfo>;
  revealData: NF4RevealData | null;
  roundHistory: NF4RoundRecord[];
  winner: string | null;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
  currentSide: 'player1' | 'player2' | null;
}

export type NumberFourAction =
  | { type: 'tutorial-ack' }
  | { type: 'submit'; white: number; black: number; number: NF4Number };

export const NF4_ADVISOR_ME = 'me';
export const NF4_ADVISOR_OPP = 'opp';
export type Nf4AdvisorWinner = 'me' | 'opp';

export interface Nf4AdvisorKifuRoundPlayer {
  nickname: string;
  white?: number;
  black?: number;
  number: NF4Number;
  success: boolean;
  scoreChange: number;
  scoreBefore: number;
  scoreAfter: number;
  byAi?: boolean;
}

export interface Nf4AdvisorKifu {
  advisor: true;
  winType: NF4WinType;
  tiebreakerReason: string | null;
  finalScores: Record<string, number>;
  roundHistory: unknown[];
  actions: Array<{
    round: number;
    players: Record<string, Nf4AdvisorKifuRoundPlayer>;
  }>;
  players: Record<string, { nickname: string }>;
}
