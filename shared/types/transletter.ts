/**
 * 트랜스레터(Trans-letter) — 자모 변형 단어 맞히기. 2인 스피드 레이스.
 *
 * 원본 단어의 **각 음절마다 초성·중성·종성 중 딱 하나**를 임의의 다른 자모로 바꿔 출제한다.
 * (받침 없는 음절도 초성/중성 중 하나를 반드시 바꾼다.)
 * 두 플레이어에게 **동일한 3문제**가 주어지고, 각자 주제 힌트 + 변형 단어를 보고 원본을 맞힌다.
 *
 * 승패 (제한시간 10분):
 *   - 먼저 3문제를 모두 맞힌 사람이 즉시 승리.
 *   - 시간 종료 시: 더 많이 맞힌 사람이 승리.
 *   - 맞힌 개수가 같으면: 그 개수에 먼저 도달한(마지막 정답을 더 빨리 낸) 사람이 승리.
 *   - 둘 다 한 문제도 못 맞혔으면 무승부.
 *
 * 판정: 각 문제의 원본 정답과 정확히 일치해야 정답 (런타임 사전 조회 없이 O(1)).
 */
import { CHO, JUNG, JONG, decompose, compose, isHangulSyllable, type Syllable } from '../lib/hangul';

export const TL_PUZZLE_COUNT = 3;
export const TL_TIME_LIMIT_SEC = 600; // 10분
export const TL_WRONG_LOCK_MS = 1500;

export type TransletterPhase = 'playing' | 'finished';

/** index 번째 문제에 word 를 제출 */
export type TransletterAction = { type: 'submit'; index: number; word: string };

/** 화면에 보이는 문제 (정답 제외) */
export interface TransletterPuzzleView {
  category: string;
  transformed: string;
}

export interface TransletterResult {
  winnerId: string | null; // null = 무승부
  reason: string;
  /** playerId → 맞힌 개수 */
  counts: Record<string, number>;
  /** 각 문제의 원본 정답 (결과 공개용) */
  answers: string[];
}

export interface TransletterGameData {
  phase: TransletterPhase;
  startedAt: number;
  timeLimitSec: number;
  /** 두 플레이어 공통 3문제 */
  puzzles: TransletterPuzzleView[];
  /** 내가 맞힌 문제 여부 (관전자는 전부 false) */
  mySolved: boolean[];
  myCount: number;
  oppCount: number;
  players: Record<string, { nickname: string }>;
  result: TransletterResult | null;
}

/* ── 자모 변형 ────────────────────────────────────────────────── */

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

/** 한 음절에서 초/중/종 중 하나를 임의의 다른 자모로 바꾼다. */
export function transformSyllable(ch: string): string {
  const s = decompose(ch);
  if (!s) return ch;

  const positions: Array<'cho' | 'jung' | 'jong'> = ['cho', 'jung'];
  if (s.jong !== 0) positions.push('jong');
  const pos = positions[randInt(positions.length)];

  const next: Syllable = { ...s };
  if (pos === 'cho') {
    let v = randInt(CHO.length);
    while (v === s.cho) v = randInt(CHO.length);
    next.cho = v;
  } else if (pos === 'jung') {
    let v = randInt(JUNG.length);
    while (v === s.jung) v = randInt(JUNG.length);
    next.jung = v;
  } else {
    let v = 1 + randInt(JONG.length - 1);
    while (v === s.jong) v = 1 + randInt(JONG.length - 1);
    next.jong = v;
  }
  return compose(next);
}

/** 단어 전체를 음절마다 1자모씩 변형. 한글 음절만 대상. */
export function transformWord(word: string): string {
  return [...word].map((ch) => (isHangulSyllable(ch) ? transformSyllable(ch) : ch)).join('');
}

export { CHO, JUNG, JONG };
