/**
 * 단어조합 — 출제 풀 + 검증 사전 진입점.
 *
 * 출제: 흔한 명사만 담은 큐레이션 목록(three-letter-words.ts)에서 3단어를 뽑는다.
 * 라운드 승패 판정: '해당 라운드의 정답 3단어'로만 한다(중복 답 불인정, O(1)).
 *
 * 검증 사전(dictSet): '검색 찬스' 아이템이 "이게 실제 단어인지" 확인할 때만 쓰는
 *   조회용 Set. 큐레이션 목록만 쓴다. 라운드 판정에는 관여하지 않으며, 아이템 사용 시에만
 *   서버 메모리에서 O(1) 조회한다(외부 API 없음). getter 호출 시 1회만 구성(지연 로딩).
 */
import { THREE_LETTER_WORDS } from './three-letter-words.js';

const isValid = (w: string) => /^[가-힣]{3}$/.test(w);

/** 출제용 단어 풀 — 라운드마다 여기서 3단어를 뽑는다. */
export function wordPickPool(): string[] {
  return [...new Set(THREE_LETTER_WORDS.filter(isValid))];
}

let _dictSet: Set<string> | null = null;

/**
 * 검증용 사전 Set (큐레이션 목록). '검색 찬스' 조회 전용.
 * 최초 호출 시 1회 구성해 캐싱한다.
 */
export function wordDictSet(): ReadonlySet<string> {
  if (!_dictSet) {
    _dictSet = new Set<string>();
    for (const w of THREE_LETTER_WORDS) if (isValid(w)) _dictSet.add(w);
  }
  return _dictSet;
}

/** 표준어 3음절 사전에 있는 단어인가 (검색 찬스 판정) */
export function isRealWord(word: string): boolean {
  return wordDictSet().has(word);
}

/** 풀 규모 (기동 로그용) */
export function wordDictStats(): { pickPool: number; dict: number } {
  return { pickPool: wordPickPool().length, dict: wordDictSet().size };
}
