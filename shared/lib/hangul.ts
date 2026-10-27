/**
 * 한글 자모 분해/조합 유틸 — 트랜스레터·모음이 없어요·조각조각·조사 고르기 등이 함께 쓴다.
 *
 * 완성형 한글(가~힣, 0xAC00~0xD7A3)은
 *   code = 0xAC00 + (초성 * 21 + 중성) * 28 + 종성
 * 초성 19 / 중성 21 / 종성 28(0=받침없음) 인덱스로 분해된다.
 */

export const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
export const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
export const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const BASE = 0xac00;
const LAST = 0xd7a3;

export interface Syllable {
  cho: number;
  jung: number;
  jong: number; // 0 = 받침 없음
}

/** 완성형 한글 1글자인가 */
export function isHangulSyllable(ch: string): boolean {
  if (ch.length !== 1) return false;
  const c = ch.charCodeAt(0);
  return c >= BASE && c <= LAST;
}

export function decompose(ch: string): Syllable | null {
  if (!isHangulSyllable(ch)) return null;
  const n = ch.charCodeAt(0) - BASE;
  return {
    cho: Math.floor(n / (21 * 28)),
    jung: Math.floor((n % (21 * 28)) / 28),
    jong: n % 28,
  };
}

export function compose(s: Syllable): string {
  return String.fromCharCode(BASE + (s.cho * 21 + s.jung) * 28 + s.jong);
}

/** 겹받침(ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ)의 종성 인덱스. 쌍받침(ㄲ·ㅆ)은 겹받침이 아니다. */
export const COMPOUND_JONG: ReadonlySet<number> = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]);

/** 마지막 글자에 받침이 있는가. 완성형 한글로 끝나지 않으면 null. */
export function lastSyllableHasBatchim(word: string): boolean | null {
  const s = decompose([...word].at(-1) ?? '');
  return s ? s.jong !== 0 : null;
}

/** 겹받침이 든 글자가 있는가 */
export function hasCompoundBatchim(word: string): boolean {
  return [...word].some((ch) => {
    const s = decompose(ch);
    return s !== null && COMPOUND_JONG.has(s.jong);
  });
}

/**
 * 모음을 뺀 자음만 — 글자마다 초성, 받침이 있으면 받침을 이어 쓴다.
 * `방송국` → `ㅂㅇㅅㅇㄱㄱ`. 한글 음절이 아닌 글자는 그대로 둔다.
 */
export function consonantSkeleton(word: string): string {
  return [...word]
    .map((ch) => {
      const s = decompose(ch);
      return s ? CHO[s.cho] + JONG[s.jong] : ch;
    })
    .join('');
}

/** 한 글자의 초성·중성·종성 자모. 받침이 없으면 jong 은 ''. 한글 음절이 아니면 null. */
export function jamoOf(ch: string): { cho: string; jung: string; jong: string } | null {
  const s = decompose(ch);
  return s ? { cho: CHO[s.cho], jung: JUNG[s.jung], jong: JONG[s.jong] } : null;
}
