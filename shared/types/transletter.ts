/**
 * 트랜스레터(Trans-letter) — 자모 변형 단어 맞히기. 2인 스피드 레이스.
 *
 * 원본 단어의 **각 음절마다 초성·중성·종성 중 딱 하나**를 임의의 다른 자모로 바꿔 출제한다.
 * (받침 없는 음절도 초성/중성 중 하나를 반드시 바꾼다.)
 *
 * 난이도(방 설정 gameOptions.transletterDifficulty, 기본 보통):
 *   - 보통: 바꿀 자모를 고르게 뽑는다. 쌍자음·겹모음이 자주 나와 바뀐 자리가 눈에 띈다.
 *   - 어려움: 그 자리에서 많이 쓰이는 자모일수록 자주 뽑는다(ㅇ·ㄱ·ㅅ, ㅏ·ㅣ, ㄴ·ㅇ·ㄹ …).
 *     쌍자음·겹모음·겹받침은 빈도에서 한 번 더 크게 깎는다. 바뀐 글자도 흔한 글자처럼 보인다.
 * 판 규칙(3문제·10분·승패)은 word-race.ts 를 모음이 없어요와 함께 쓴다.
 */
import {
  CHO,
  JUNG,
  JONG,
  COMPOUND_JONG,
  decompose,
  compose,
  isHangulSyllable,
  type Syllable,
} from '../lib/hangul';
import {
  WR_PUZZLE_COUNT,
  WR_TIME_LIMIT_SEC,
  WR_WRONG_LOCK_MS,
  type WordRaceAction,
  type WordRaceGameData,
  type WordRacePhase,
  type WordRacePuzzleView,
  type WordRaceResult,
} from './word-race';

export const TL_PUZZLE_COUNT = WR_PUZZLE_COUNT;
export const TL_TIME_LIMIT_SEC = WR_TIME_LIMIT_SEC;
export const TL_WRONG_LOCK_MS = WR_WRONG_LOCK_MS;

export type TransletterPhase = WordRacePhase;
export type TransletterAction = WordRaceAction;
export type TransletterPuzzleView = WordRacePuzzleView;
export type TransletterResult = WordRaceResult;
export type TransletterGameData = WordRaceGameData;

/* ── 난이도 ──────────────────────────────────────────────────── */

export const TRANSLETTER_DIFFICULTIES = ['normal', 'hard'] as const;
export type TransletterDifficulty = (typeof TRANSLETTER_DIFFICULTIES)[number];
export const DEFAULT_TRANSLETTER_DIFFICULTY: TransletterDifficulty = 'normal';

export function resolveTransletterDifficulty(value: unknown): TransletterDifficulty {
  return value === 'hard' ? 'hard' : DEFAULT_TRANSLETTER_DIFFICULTY;
}

/*
  자리별 자모 사용 빈도(%) — 어려움의 뽑기 가중치. 순서는 CHO / JUNG / JONG 배열과 같다.
  scripts/jamo-frequency.mjs 로 두 말뭉치(저장소 문서·화면 문구 약 63만 자, 출제 단어
  topic-words)를 세어 평균 낸 값이다. 단어를 크게 늘리면 스크립트를 다시 돌려 맞춘다.
*/
// prettier-ignore
const CHO_FREQ = [
  13.5, 1.0, 3.9, 6.9, 0.4, 7.4, 6.6, 6.6, 0.3, 11.3,
  0.3, 14.5, 9.4, 0.2, 4.0, 2.1, 3.3, 3.0, 5.1,
];
// prettier-ignore
const JUNG_FREQ = [
  21.3, 5.4, 0.8, 0.0, 9.0, 4.3, 4.0, 0.5, 12.7, 2.6,
  0.1, 0.6, 0.9, 10.3, 0.8, 0.0, 0.7, 1.0, 8.1, 0.4, 16.5,
];
// prettier-ignore
const JONG_FREQ = [
  0, 13.9, 0.2, 0.0, 24.4, 0.0, 0.2, 0.1, 16.7, 0.2,
  0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 9.6, 4.1, 0.4, 1.8,
  0.4, 26.1, 0.2, 0.7, 0.0, 0.4, 0.3, 0.1,
];

/** 쌍자음·겹모음·겹받침은 빈도에 이 값을 한 번 더 곱한다 */
export const TL_HARD_COMPOUND_FACTOR = 0.2;
/** 초성 쌍자음 ㄲ ㄸ ㅃ ㅆ ㅉ */
export const DOUBLE_CHO: ReadonlySet<number> = new Set([1, 4, 8, 10, 13]);
/** 겹모음(모음 두 개를 합친 글자) ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ */
export const COMPOUND_JUNG: ReadonlySet<number> = new Set([9, 10, 11, 14, 15, 16, 19]);
/** 받침 쌍자음 ㄲ ㅆ + 겹받침 ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ */
export const COMPOUND_JONG_ALL: ReadonlySet<number> = new Set([2, 20, ...COMPOUND_JONG]);

function hardWeights(freq: number[], compound: ReadonlySet<number>): number[] {
  return freq.map((f, i) => (compound.has(i) ? f * TL_HARD_COMPOUND_FACTOR : f));
}

/** 어려움에서 자리별로 각 자모가 뽑힐 가중치 (종성 0 = 받침 없음은 뽑지 않는다) */
export const TL_HARD_WEIGHTS = {
  cho: hardWeights(CHO_FREQ, DOUBLE_CHO),
  jung: hardWeights(JUNG_FREQ, COMPOUND_JUNG),
  jong: hardWeights(JONG_FREQ, COMPOUND_JONG_ALL),
} as const;

/* ── 자모 변형 ────────────────────────────────────────────────── */

/** weights 비율로 하나를 뽑는다. except 와 가중치 0 은 뽑지 않는다. */
function pickWeighted(weights: readonly number[], except: number, rand: () => number): number {
  const total = weights.reduce((sum, w, i) => (i === except ? sum : sum + w), 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    if (i === except || weights[i] <= 0) continue;
    r -= weights[i];
    if (r < 0) return i;
  }
  // 부동소수 오차로 끝까지 왔을 때 — 마지막 후보
  for (let i = weights.length - 1; i >= 0; i--) if (i !== except && weights[i] > 0) return i;
  return except;
}

/** from 이상 n 미만에서 except 가 아닌 수를 고르게 뽑는다 */
function pickUniform(from: number, n: number, except: number, rand: () => number): number {
  let v = from + Math.floor(rand() * (n - from));
  while (v === except) v = from + Math.floor(rand() * (n - from));
  return v;
}

/** 한 음절에서 초/중/종 중 하나를 다른 자모로 바꾼다. */
export function transformSyllable(
  ch: string,
  difficulty: TransletterDifficulty = DEFAULT_TRANSLETTER_DIFFICULTY,
  rand: () => number = Math.random,
): string {
  const s = decompose(ch);
  if (!s) return ch;

  const positions: Array<'cho' | 'jung' | 'jong'> = ['cho', 'jung'];
  if (s.jong !== 0) positions.push('jong');
  const pos = positions[Math.floor(rand() * positions.length)];

  const hard = difficulty === 'hard';
  const next: Syllable = { ...s };
  if (pos === 'cho') {
    next.cho = hard
      ? pickWeighted(TL_HARD_WEIGHTS.cho, s.cho, rand)
      : pickUniform(0, CHO.length, s.cho, rand);
  } else if (pos === 'jung') {
    next.jung = hard
      ? pickWeighted(TL_HARD_WEIGHTS.jung, s.jung, rand)
      : pickUniform(0, JUNG.length, s.jung, rand);
  } else {
    next.jong = hard
      ? pickWeighted(TL_HARD_WEIGHTS.jong, s.jong, rand)
      : pickUniform(1, JONG.length, s.jong, rand);
  }
  return compose(next);
}

/** 단어 전체를 음절마다 1자모씩 변형. 한글 음절만 대상. */
export function transformWord(
  word: string,
  difficulty: TransletterDifficulty = DEFAULT_TRANSLETTER_DIFFICULTY,
): string {
  return [...word]
    .map((ch) => (isHangulSyllable(ch) ? transformSyllable(ch, difficulty) : ch))
    .join('');
}

export { CHO, JUNG, JONG };
