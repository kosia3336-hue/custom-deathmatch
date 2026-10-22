/** 모음이 없어요 — 서버 모듈. 판 규칙(3문제·10분·스피드 레이스)은 word-race 엔진을 쓴다. */
import { WR_PUZZLE_COUNT } from '@shared/types/word-race.js';
import { canAskNoVowel, noVowelPuzzle } from '@shared/types/no-vowel.js';
import { topicWordEntries } from '@shared/data/topic-words.js';
import { createWordRace, pickDistinct, type WordRacePuzzle } from '../word-race/engine.js';

const ENTRIES = topicWordEntries().filter((e) => canAskNoVowel(e.word));

/** 주제 + 자음 → 그 자음을 가진 같은 주제 단어들. 자음이 같으면 어느 쪽을 써도 정답이다. */
const SAME_SKELETON = new Map<string, Set<string>>();
for (const e of ENTRIES) {
  const key = `${e.category}|${noVowelPuzzle(e.word)}`;
  const set = SAME_SKELETON.get(key) ?? new Set<string>();
  set.add(e.word);
  SAME_SKELETON.set(key, set);
}

console.log(`[no-vowel] 출제 단어 ${ENTRIES.length}개 로드`);

/** 서로 다른 3문제 — 같은 자음 문제가 두 번 나오지 않게 자음으로 고른다 */
function makePuzzles(): WordRacePuzzle[] {
  return pickDistinct(ENTRIES, WR_PUZZLE_COUNT, (e) => noVowelPuzzle(e.word)).map((e) => {
    const shown = noVowelPuzzle(e.word);
    return {
      category: e.category,
      shown,
      answer: e.word,
      accepts: SAME_SKELETON.get(`${e.category}|${shown}`) ?? new Set([e.word]),
    };
  });
}

export const noVowelRace = createWordRace({ makePuzzles });

export const initNoVowel = noVowelRace.init;
export const handleNoVowelAction = noVowelRace.handleAction;
export const cleanupNoVowel = noVowelRace.cleanup;
export const getNoVowelState = noVowelRace.getState;
export const emitNoVowelStateToSocket = noVowelRace.emitStateToSocket;
export const performNoVowelUndo = noVowelRace.performUndo;
export const canNoVowelUndo = noVowelRace.canUndo;
export const getNoVowelResultData = noVowelRace.getResultData;
