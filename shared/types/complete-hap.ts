/** 컴플릿 결! 합! — 9장 문제의 모든 합을 저장한 뒤 결로 일괄 제출하는 7라운드 게임. */

import type { PlayMode } from './room';

export const CH_TOTAL_ROUNDS = 7;
/** 7라운드 대전에서 승리를 확정하는 선취 점수. 솔로에는 적용하지 않는다. */
export const CH_WIN_SCORE = 4;
export const CH_CARDS_PER_BOARD = 9;
export const CH_MATCH_SECONDS = 10 * 60;

export type CompleteHapShape = 'circle' | 'triangle' | 'square';
export type CompleteHapBackground = 'black' | 'gray' | 'white';
export type CompleteHapCardColor = 'red' | 'yellow' | 'blue';

export interface CompleteHapCard {
  shape: CompleteHapShape;
  background: CompleteHapBackground;
  color: CompleteHapCardColor;
}

export function completeHapCardKey(card: CompleteHapCard): string {
  return `${card.shape}:${card.background}:${card.color}`;
}

export type CompleteHapPhase = 'playing' | 'round-result' | 'finished';

/** 결을 외쳐 한 라운드에 저장한 합 전체를 제출한 결과. */
export interface CompleteHapRoundResult {
  round: number;
  callerId: string;
  /** 정답이면 callerId, 오답이면 상대 플레이어, 솔로 오답이면 null. */
  pointPlayerId: string | null;
  correct: boolean;
  submittedSets: number[][];
  answerSets: number[][];
  /** 해당 라운드가 공개된 뒤 결을 외치기까지 걸린 시간. */
  elapsedMs: number;
  /** 게임 시작 뒤 결을 외치기까지 걸린 시간. */
  matchElapsedMs: number;
}

export interface CompleteHapBoard {
  cards: CompleteHapCard[];
}

export type CompleteHapAction = {
  type: 'call-gyul';
  /** 플레이어가 로컬에 저장해 두었다가 결을 외치며 한 번에 제출하는 합 목록. */
  sets: number[][];
};

export interface CompleteHapGameData {
  phase: CompleteHapPhase;
  board: CompleteHapBoard;
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  roundStartedAt: number;
  matchStartedAt: number;
  /** null이면 멀티 무제한 방. COM·솔로는 기본 10분이다. */
  matchSeconds: number | null;
  lastRoundResult: CompleteHapRoundResult | null;
  isSolo: boolean;
  playMode: PlayMode;
  winnerId: string | null;
  finishReason: string | null;
}

export type CompleteHapTiebreak = 'solo' | 'count' | 'speed' | 'zero-draw';

export interface CompleteHapArchiveRound {
  round: number;
  cards: CompleteHapCard[];
  allSets: number[][];
  result: CompleteHapRoundResult | null;
}

export interface CompleteHapArchiveRecord {
  rounds: CompleteHapArchiveRound[];
  totalRounds: number;
  finalScores: Record<string, number>;
  roundResults: CompleteHapRoundResult[];
  tiebreak: CompleteHapTiebreak;
  players: Record<string, { nickname: string }>;
  winnerId: string | null;
  finishReason: string;
}
