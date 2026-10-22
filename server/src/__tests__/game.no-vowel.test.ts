/**
 * 모음이 없어요 + 트랜스레터가 함께 쓰는 단어 스피드 레이스 엔진.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { WordRaceGameData } from '@shared/types/word-race.js';
import {
  COMPOUND_JONG,
  consonantSkeleton,
  hasCompoundBatchim,
  lastSyllableHasBatchim,
} from '@shared/lib/hangul.js';
import { canAskNoVowel, noVowelPuzzle } from '@shared/types/no-vowel.js';
import { topicWordEntries, TOPIC_WORDS } from '@shared/data/topic-words.js';
import { josa } from '@shared/lib/josa.js';
import { noVowelRace } from '../socket/games/no-vowel/index.js';
import { transletterRace } from '../socket/games/transletter/index.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { sessions } from '../store/sessions.js';

describe('한글 공통 유틸', () => {
  it('자음만 남긴다 — 초성 + 받침', () => {
    expect(consonantSkeleton('방송국')).toBe('ㅂㅇㅅㅇㄱㄱ');
    expect(consonantSkeleton('바다')).toBe('ㅂㄷ');
    expect(consonantSkeleton('떡볶이')).toBe('ㄸㄱㅂㄲㅇ');
  });

  it('겹받침만 겹받침으로 본다 — 쌍받침(ㄲ·ㅆ)은 아니다', () => {
    expect(COMPOUND_JONG.size).toBe(11);
    expect(hasCompoundBatchim('수탉')).toBe(true);
    expect(hasCompoundBatchim('닭갈비')).toBe(true);
    expect(hasCompoundBatchim('떡볶이')).toBe(false);
    expect(hasCompoundBatchim('있다')).toBe(false);
  });

  it('마지막 글자 받침', () => {
    expect(lastSyllableHasBatchim('국')).toBe(true);
    expect(lastSyllableHasBatchim('바다')).toBe(false);
    expect(lastSyllableHasBatchim('Tom')).toBeNull();
    expect(lastSyllableHasBatchim('')).toBeNull();
  });

  it('조사 고르기는 그대로', () => {
    expect(josa('방송국', '이/가')).toBe('방송국이');
    expect(josa('바다', '을/를')).toBe('바다를');
    expect(josa('서울', '으로/로')).toBe('서울로');
  });
});

describe('주제 단어', () => {
  it('트랜스레터 주제를 함께 쓰고 장소·자연을 나눠 둔다', () => {
    const names = TOPIC_WORDS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['동물', '음식', '자연', '장소']));
    expect(TOPIC_WORDS.find((t) => t.name === '장소')!.words).toContain('방송국');
  });

  it('모음이 없어요는 겹받침 단어를 내지 않는다', () => {
    const asked = topicWordEntries().filter((e) => canAskNoVowel(e.word));
    expect(asked.some((e) => e.word === '수탉')).toBe(false);
    expect(asked.every((e) => !hasCompoundBatchim(e.word))).toBe(true);
    expect(asked.length).toBeGreaterThan(300);
  });
});

const ROOM = 'no-vowel-room';
const ids = ['nv-a', 'nv-b'];

afterEach(() => {
  noVowelRace.cleanup(ROOM);
  transletterRace.cleanup(ROOM);
  for (const id of ids) sessions.removeSession(`sock-${id}`);
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setup(race: typeof noVowelRace) {
  vi.useFakeTimers();
  const sockets = ids.map((id) => {
    sessions.linkToken(`sock-${id}`, id);
    return { id: `sock-${id}`, emit: vi.fn() };
  });
  const io = {
    in: () => ({ fetchSockets: async () => sockets }),
    to: () => ({ emit: vi.fn() }),
  } as unknown as IO;
  const players = ids.map(
    (id, i) => ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: Date.now() }) as Player,
  );
  const end = vi.fn();
  race.init(io, ROOM, players, 'multi', Date.now(), null, end);
  const submit = (who: number, index: number, word: string) =>
    race.handleAction(io, sockets[who] as unknown as TypedSocket, ROOM, { type: 'submit', index, word });
  const lastState = (who: number) =>
    sockets[who].emit.mock.calls.filter(([e]) => e === 'game:state').at(-1)?.[1].gameData as WordRaceGameData;
  return { sockets, submit, lastState, end };
}

describe('모음이 없어요 판', () => {
  it('문제는 정답의 자음만 보여 주고, 정답은 화면에 보내지 않는다', async () => {
    const { lastState } = setup(noVowelRace);
    await vi.advanceTimersByTimeAsync(0);
    const puzzles = noVowelRace.puzzlesOf(ROOM)!;
    expect(puzzles).toHaveLength(3);
    for (const p of puzzles) {
      expect(p.shown).toBe(noVowelPuzzle(p.answer));
      expect(p.shown).toMatch(/^[ㄱ-ㅎ]+$/);
      expect(canAskNoVowel(p.answer)).toBe(true);
    }
    expect(new Set(puzzles.map((p) => p.shown)).size).toBe(3);
    const view = lastState(0);
    expect(view.puzzles.map((p) => p.shown)).toEqual(puzzles.map((p) => p.shown));
    expect(JSON.stringify(view)).not.toContain(puzzles[0].answer);
  });

  it('같은 주제에서 자음이 같은 단어도 정답, 3문제를 먼저 다 맞히면 이긴다', async () => {
    const { submit, lastState, end, sockets } = setup(noVowelRace);
    const puzzles = noVowelRace.puzzlesOf(ROOM)!;
    submit(0, 0, '틀린단어');
    expect(sockets[0].emit.mock.calls.some(([e, d]) => e === 'error' && /땡/.test(d.message))).toBe(true);

    for (const p of puzzles) {
      for (const w of p.accepts) {
        expect(noVowelPuzzle(w)).toBe(p.shown);
      }
    }
    const other = [...puzzles[0].accepts].find((w) => w !== puzzles[0].answer) ?? puzzles[0].answer;
    submit(0, 0, other);
    submit(0, 1, puzzles[1].answer);
    await vi.advanceTimersByTimeAsync(0);
    expect(lastState(0).myCount).toBe(2);
    expect(lastState(1).oppCount).toBe(2);
    submit(0, 2, puzzles[2].answer);
    await vi.advanceTimersByTimeAsync(0);
    expect(lastState(1).result?.winnerId).toBe('nv-a');
    expect(lastState(1).result?.answers).toEqual(puzzles.map((p) => p.answer));
    await vi.advanceTimersByTimeAsync(3500);
    expect(end).toHaveBeenCalledOnce();
  });

  it('시간이 끝나면 더 많이 맞힌 쪽이 이긴다', async () => {
    const { submit, lastState } = setup(noVowelRace);
    const puzzles = noVowelRace.puzzlesOf(ROOM)!;
    submit(1, 2, puzzles[2].answer);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(lastState(0).result?.winnerId).toBe('nv-b');
  });
});

describe('트랜스레터 (같은 엔진)', () => {
  it('바뀐 단어를 보여 주고 원래 단어만 정답', async () => {
    const { submit, lastState } = setup(transletterRace);
    const puzzles = transletterRace.puzzlesOf(ROOM)!;
    for (const p of puzzles) {
      expect([...p.shown]).toHaveLength([...p.answer].length);
      expect(p.accepts).toEqual(new Set([p.answer]));
    }
    submit(0, 0, puzzles[0].answer);
    await vi.advanceTimersByTimeAsync(0);
    expect(lastState(0).mySolved).toEqual([true, false, false]);
  });
});
