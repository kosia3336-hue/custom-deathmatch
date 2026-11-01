/** 트랜스레터 — 서버 모듈. 판 규칙(3문제·10분·스피드 레이스)은 word-race 엔진을 쓴다. */
import {
  TL_PUZZLE_COUNT,
  resolveTransletterDifficulty,
  transformWord,
} from '@shared/types/transletter.js';
import { topicWordEntries } from '@shared/data/topic-words.js';
import { createWordRace, pickDistinct, type WordRacePuzzle } from '../word-race/engine.js';

const ENTRIES = topicWordEntries();

console.log(`[transletter] 출제 단어 ${ENTRIES.length}개 로드`);

/** 서로 다른 3문제 생성 (변형이 원본과 같으면 재시도) */
function makePuzzles(gameOptions: Record<string, unknown>): WordRacePuzzle[] {
  const difficulty = resolveTransletterDifficulty(gameOptions.transletterDifficulty);
  return pickDistinct(ENTRIES, TL_PUZZLE_COUNT, (e) => e.word).map((e) => {
    let shown = transformWord(e.word, difficulty);
    let t = 0;
    while (shown === e.word && t++ < 10) shown = transformWord(e.word, difficulty);
    return { category: e.category, shown, answer: e.word, accepts: new Set([e.word]) };
  });
}

export const transletterRace = createWordRace({
  makePuzzles,
  levelLabel: (gameOptions) =>
    resolveTransletterDifficulty(gameOptions.transletterDifficulty) === 'hard'
      ? '어려움'
      : undefined,
});

export const initTransletter = transletterRace.init;
export const handleTransletterAction = transletterRace.handleAction;
export const cleanupTransletter = transletterRace.cleanup;
export const getTransletterState = transletterRace.getState;
export const emitTransletterStateToSocket = transletterRace.emitStateToSocket;
export const performTransletterUndo = transletterRace.performUndo;
export const canTransletterUndo = transletterRace.canUndo;
export const getTransletterResultData = transletterRace.getResultData;
