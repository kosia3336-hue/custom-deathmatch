/**
 * 단어조합 — 출제 풀 진입점.
 *
 * 검증은 '해당 라운드의 정답 3단어'로만 한다(중복 답 불인정). 런타임에 대사전을
 * 상주시키지 않고, 사전 조회·외부 API 도 없다 (O(1) 검증). 여기서는 출제용 풀만 제공한다.
 * 출제 풀은 흔한 명사만 담은 큐레이션 목록(three-letter-words.ts)을 쓴다.
 */
import { THREE_LETTER_WORDS } from './three-letter-words.js';

const isValid = (w: string) => /^[가-힣]{3}$/.test(w);

/** 출제용 단어 풀 — 라운드마다 여기서 3단어를 뽑는다. */
export function wordPickPool(): string[] {
  return [...new Set(THREE_LETTER_WORDS.filter(isValid))];
}

/** 풀 규모 (기동 로그용) */
export function wordDictStats(): { pickPool: number } {
  return { pickPool: wordPickPool().length };
}
