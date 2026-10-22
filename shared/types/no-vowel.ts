/**
 * 모음이 없어요 — 자음만 보고 단어 맞히기. 2인 스피드 레이스.
 *
 * 단어의 모음을 모두 지우고, 글자마다 초성과(받침이 있으면) 받침만 이어서 보여 준다.
 *   주제: 장소 / 문제: ㅂㅇㅅㅇㄱㄱ → 정답: 방송국
 * 글자 경계는 보여 주지 않는다. 겹받침(ㄳ·ㄺ…)이 든 단어는 내지 않는다(쌍받침 ㄲ·ㅆ 은 낸다).
 * 같은 주제 안에 자음이 똑같은 단어가 또 있으면 그 단어도 정답으로 받는다.
 * 판 규칙(3문제·10분·승패)은 word-race.ts 를 트랜스레터와 함께 쓴다.
 */
import { consonantSkeleton, hasCompoundBatchim } from '../lib/hangul';
import type { WordRaceAction, WordRaceGameData } from './word-race';

export type NoVowelAction = WordRaceAction;
export type NoVowelGameData = WordRaceGameData;

/** 출제할 수 있는 단어인가 — 겹받침이 없어야 한다 */
export function canAskNoVowel(word: string): boolean {
  return !hasCompoundBatchim(word);
}

/** 문제로 보여 줄 글자 */
export function noVowelPuzzle(word: string): string {
  return consonantSkeleton(word);
}
