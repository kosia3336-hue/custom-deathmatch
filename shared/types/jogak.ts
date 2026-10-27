/**
 * 조각조각 — 글자마다 자모 하나만 남은 조각을 보고 단어 맞히기. 2인 라운드 대결.
 *
 * 매 라운드 단어 하나를 골라, 글자마다 초성·중성·종성 중 하나를 무작위로 남겨 주제와 함께 보여 준다.
 *   주제: 음식 / 문제: ㅍ ㅏ → 정답: 피자 (피의 초성, 자의 중성)
 * 어느 자리(초·중·종성)의 조각인지는 알려 주지 않는다. 조각이 모두 모음인 문제는 내지 않는다.
 * 같은 주제 안에서 글자 수가 같고 글자마다 그 조각을 가진 단어면 정답으로 받는다.
 *
 * 승패: 7라운드, 4점 선취(7전 4승제). 두 사람이 같은 문제를 동시에 보고 먼저 맞힌 사람이 1점.
 *   - 라운드 제한시간 안에 아무도 못 맞히면 그 라운드는 점수 없이 넘어간다.
 *   - 남은 라운드를 다 이겨도 따라잡을 수 없으면 그 자리에서 끝낸다.
 *   - 7라운드가 끝나면 점수가 많은 쪽이 승리, 같으면 무승부.
 * 1인 솔로: 혼자 7문제를 모두 푼다.
 */
import { jamoOf } from '../lib/hangul';

export const JG_TOTAL_ROUNDS = 7;
export const JG_WIN_SCORE = 4;
export const JG_ROUND_SEC = 60;
/** 라운드가 끝나고 정답을 보여 주는 시간 */
export const JG_REVEAL_MS = 3000;
export const JG_WRONG_LOCK_MS = 1500;

export type JogakPhase = 'playing' | 'reveal' | 'finished';

export type JogakAction = { type: 'submit'; round: number; word: string };

/** 끝난 라운드 기록 */
export interface JogakRoundRecord {
  round: number;
  category: string;
  pieces: string[];
  answer: string;
  /** null = 아무도 못 맞힘 */
  winnerId: string | null;
}

export interface JogakResult {
  winnerId: string | null; // null = 무승부
  reason: string;
}

export interface JogakGameData {
  phase: JogakPhase;
  /** 1부터 */
  round: number;
  totalRounds: number;
  winScore: number;
  roundSeconds: number;
  roundStartedAt: number;
  category: string;
  /** 글자마다 남은 자모 하나 */
  pieces: string[];
  scores: Record<string, number>;
  /** 끝난 라운드 (정답 공개) */
  history: JogakRoundRecord[];
  players: Record<string, { nickname: string }>;
  result: JogakResult | null;
  isSolo: boolean;
}

const VOWEL = /^[ㅏ-ㅣ]$/;

/** 글자마다 초·중·종성 중 하나를 무작위로 남긴다. 조각이 모두 모음이면 다시 고른다. */
export function makePieces(word: string, rand: () => number = Math.random): string[] {
  const syllables = [...word].map((ch) => jamoOf(ch));
  if (syllables.some((s) => s === null)) throw new Error(`한글 단어가 아님: ${word}`);
  for (let tries = 0; ; tries++) {
    const pieces = syllables.map((s) => {
      const parts = [s!.cho, s!.jung, s!.jong].filter(Boolean);
      return parts[Math.floor(rand() * parts.length)];
    });
    if (!pieces.every((p) => VOWEL.test(p))) return pieces;
    // 모두 모음이 계속 나오면 첫 글자의 초성으로 바꿔 끝낸다
    if (tries >= 20) return [syllables[0]!.cho, ...pieces.slice(1)];
  }
}

/** word 가 이 조각들로 낼 수 있는 단어인가 — 글자 수가 같고 글자마다 그 자모를 가진다 */
export function fitsPieces(word: string, pieces: readonly string[]): boolean {
  const chars = [...word];
  if (chars.length !== pieces.length) return false;
  return chars.every((ch, i) => {
    const s = jamoOf(ch);
    return s !== null && (s.cho === pieces[i] || s.jung === pieces[i] || s.jong === pieces[i]);
  });
}
