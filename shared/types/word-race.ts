/**
 * 단어 맞히기 2인 스피드 레이스 — 트랜스레터·모음이 없어요가 같은 판 규칙을 쓴다.
 *
 * 두 플레이어에게 **같은 3문제**를 주고, 각자 주제 힌트 + 문제를 보고 원래 단어를 맞힌다.
 * 문제를 어떻게 내는지(자모를 바꾸는지, 모음을 지우는지)만 게임마다 다르다.
 *
 * 승패 (제한시간 10분):
 *   - 먼저 3문제를 모두 맞힌 사람이 즉시 승리.
 *   - 시간 종료 시: 더 많이 맞힌 사람이 승리.
 *   - 맞힌 개수가 같으면: 그 개수에 먼저 도달한(마지막 정답을 더 빨리 낸) 사람이 승리.
 *   - 둘 다 한 문제도 못 맞혔으면 무승부.
 * 1인 솔로: 혼자 3문제를 푼다.
 *
 * 판정: 출제할 때 정해 둔 정답 목록과 정확히 일치해야 정답 (런타임 사전 조회 없이 O(1)).
 */

export const WR_PUZZLE_COUNT = 3;
export const WR_TIME_LIMIT_SEC = 600; // 10분
export const WR_WRONG_LOCK_MS = 1500;

export type WordRacePhase = 'playing' | 'finished';

/** index 번째 문제에 word 를 제출 */
export type WordRaceAction = { type: 'submit'; index: number; word: string };

/** 화면에 보이는 문제 (정답 제외) */
export interface WordRacePuzzleView {
  category: string;
  /** 문제로 보여 줄 글자 — 트랜스레터는 바뀐 단어, 모음이 없어요는 자음만 */
  shown: string;
}

export interface WordRaceResult {
  winnerId: string | null; // null = 무승부
  reason: string;
  /** playerId → 맞힌 개수 */
  counts: Record<string, number>;
  /** 각 문제의 원본 정답 (결과 공개용) */
  answers: string[];
}

export interface WordRaceGameData {
  phase: WordRacePhase;
  startedAt: number;
  timeLimitSec: number;
  /** 두 플레이어 공통 3문제 */
  puzzles: WordRacePuzzleView[];
  /** 내가 맞힌 문제 여부 (관전자는 전부 false) */
  mySolved: boolean[];
  myCount: number;
  oppCount: number;
  players: Record<string, { nickname: string }>;
  result: WordRaceResult | null;
  /** 1인 솔로 모드 — 상대 없이 혼자 3문제를 푼다 */
  isSolo: boolean;
  /** 난이도 이름 (트랜스레터 '어려움'). 없으면 표시하지 않는다. */
  levelLabel?: string;
}
