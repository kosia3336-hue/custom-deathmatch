/**
 * 단어 퍼즐 — 3글자 단어 3개의 글자 9개를 3×3 격자에 섞어 놓고
 * 원본 단어 3개를 조합해 맞추는 1:1 스피드 퍼즐.
 *
 * 판정: 제출한 3단어가 모두 사전에 있고, 9칸 글자를 정확히 소진하면 정답
 *       (원본과 다른 유효 조합도 정답으로 인정 — 중복 해법 억울함 방지)
 */

export const WP_TOTAL_ROUNDS = 3;
export const WP_ROUND_SECONDS = 90;
/** 오답 제출 시 클라이언트 재제출 잠금 */
export const WP_WRONG_LOCK_MS = 3000;
export const WP_REVEAL_MS = 5000;

export type WordPuzzlePhase = 'playing' | 'reveal' | 'finished';

export type WordPuzzleAction = { type: 'submit'; words: string[] };

export interface WordPuzzleRoundResult {
  round: number;
  winnerId: string | null; // null = 시간 초과
  answerWords: string[];   // 출제 원본
  submittedWords: string[] | null; // 승자가 제출한 조합 (원본과 다를 수 있음)
  elapsedMs: number | null;
}

export interface WordPuzzleGameData {
  phase: WordPuzzlePhase;
  round: number;
  totalRounds: number;
  /** 3×3 격자 글자 (행 우선 9칸) */
  grid: string[];
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  roundStartedAt: number;
  roundSeconds: number;
  /** reveal 단계에서만 채워짐 */
  lastResult: WordPuzzleRoundResult | null;
  history: WordPuzzleRoundResult[];
}
