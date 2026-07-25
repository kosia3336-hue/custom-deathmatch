/**
 * 한글 자모 분해/조합 유틸 — 트랜스레터 등에서 음절 단위 변형에 사용.
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
