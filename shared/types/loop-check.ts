export const LOOP_CHECK_SIZE = 6;
export const LOOP_CHECK_PATH_LENGTH = 10;
export const LOOP_CHECK_BEST_OF = [3, 5, 7] as const;
export type LoopCheckBestOf = (typeof LOOP_CHECK_BEST_OF)[number];
export type LoopCheckColorMode = 'standard' | 'colorblind';
export type LoopCheckColor = number;
export const LOOP_CHECK_REVEAL_MS = 2800;

/** Pantone 기준 웹 근사색. 색약 모드는 색 외에도 고유 기호를 함께 표시한다. */
export const LOOP_CHECK_COLORS = [
  { name: '빨강', pantone: '186 C', hex: '#C8102E', accessibleHex: '#CC6677', symbol: '●' },
  { name: '주황', pantone: '165 C', hex: '#FF671F', accessibleHex: '#EE7733', symbol: '▲' },
  { name: '노랑', pantone: '109 C', hex: '#FFD100', accessibleHex: '#DDCC77', symbol: '■' },
  { name: '연두', pantone: '375 C', hex: '#97D700', accessibleHex: '#AA4499', symbol: '◆' },
  { name: '초록', pantone: '354 C', hex: '#00B140', accessibleHex: '#117733', symbol: '★' },
  { name: '하늘', pantone: '2995 C', hex: '#00A9E0', accessibleHex: '#88CCEE', symbol: '✚' },
  { name: '파랑', pantone: '286 C', hex: '#0033A0', accessibleHex: '#332288', symbol: '✕' },
  { name: '보라', pantone: '2592 C', hex: '#9B26B6', accessibleHex: '#882255', symbol: '◎' },
  {
    name: '분홍',
    pantone: 'Rhodamine Red C',
    hex: '#E10098',
    accessibleHex: '#44AA99',
    symbol: '≋',
  },
  { name: '검정', pantone: 'Black 6 C', hex: '#101820', accessibleHex: '#222222', symbol: '⊞' },
] as const;

export function resolveLoopCheckOptions(options: Record<string, unknown> = {}) {
  const bestOf: LoopCheckBestOf =
    options.loopCheckBestOf === 3 ? 3 : options.loopCheckBestOf === 7 ? 7 : 5;
  const colorMode: LoopCheckColorMode =
    options.loopCheckColorMode === 'colorblind' ? 'colorblind' : 'standard';
  return { bestOf, colorMode, winScore: Math.floor(bestOf / 2) + 1 };
}

export interface LoopCheckBoard {
  cells: LoopCheckColor[];
}
export type LoopCheckAction = { type: 'submit'; roundId: string; path: number[] };
export interface LoopCheckRoundResult {
  round: number;
  board: LoopCheckBoard;
  winnerId: string | null;
  path: number[];
  outcome: 'correct' | 'timeout';
  elapsedMs: number | null;
  scoresAfter: Record<string, number>;
}
export interface LoopCheckGameData {
  phase: 'playing' | 'reveal' | 'finished';
  round: number;
  roundId: string;
  bestOf: LoopCheckBestOf;
  winScore: number;
  colorMode: LoopCheckColorMode;
  board: LoopCheckBoard;
  scores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  roundStartedAt: number;
  roundSeconds: number | null;
  lastResult: LoopCheckRoundResult | null;
  history: LoopCheckRoundResult[];
  myFeedback: { message: string; attemptedAt: number } | null;
  isSolo: boolean;
}
export interface LoopCheckArchiveRecord {
  bestOf: LoopCheckBestOf;
  winScore: number;
  colorMode: LoopCheckColorMode;
  finalScores: Record<string, number>;
  players: Record<string, { nickname: string }>;
  history: LoopCheckRoundResult[];
}
