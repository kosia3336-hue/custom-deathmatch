/**
 * 트랜스레터(Trans-letter) — 자모 변형 단어 맞히기. 2인 스피드 레이스.
 *
 * 원본 단어의 **각 음절마다 초성·중성·종성 중 딱 하나**를 임의의 다른 자모로 바꿔 출제한다.
 * (받침 없는 음절도 초성/중성 중 하나를 반드시 바꾼다.)
 * 판 규칙(3문제·10분·승패)은 word-race.ts 를 모음이 없어요와 함께 쓴다.
 */
import { CHO, JUNG, JONG, decompose, compose, isHangulSyllable, type Syllable } from '../lib/hangul';
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
