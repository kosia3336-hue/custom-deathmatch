/**
 * 트랜스레터 '어려움' — 자주 쓰이는 자모로 바꾸고, 쌍자음·겹모음·겹받침은 거의 내지 않는다.
 * 실제 출제 단어로 수만 번 변형해 바뀐 자모의 분포를 확인한다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { WordRaceGameData } from '@shared/types/word-race.js';
import { CHO, JONG, JUNG, decompose } from '@shared/lib/hangul.js';
import {
  COMPOUND_JONG_ALL,
  COMPOUND_JUNG,
  DOUBLE_CHO,
  TL_HARD_WEIGHTS,
  resolveTransletterDifficulty,
  transformSyllable,
  type TransletterDifficulty,
} from '@shared/types/transletter.js';
import { topicWordEntries } from '@shared/data/topic-words.js';
import { transletterRace } from '../socket/games/transletter/index.js';
import type { IO } from '../socket/types.js';
import { sessions } from '../store/sessions.js';

const SYLLABLES = topicWordEntries().flatMap((e) => [...e.word]);

/** 변형을 n 번 해서 바뀐 자리·자모를 센다 */
function simulate(difficulty: TransletterDifficulty, n = 30_000) {
  const picked = {
    cho: new Map<string, number>(),
    jung: new Map<string, number>(),
    jong: new Map<string, number>(),
  };
  let compound = 0;
  for (let i = 0; i < n; i++) {
    const ch = SYLLABLES[i % SYLLABLES.length]!;
    const a = decompose(ch)!;
    const b = decompose(transformSyllable(ch, difficulty))!;
    const changed = [a.cho !== b.cho, a.jung !== b.jung, a.jong !== b.jong].filter(Boolean).length;
    expect(changed).toBe(1); // 딱 한 자리만 바뀐다
    if (a.cho !== b.cho) {
      picked.cho.set(CHO[b.cho]!, (picked.cho.get(CHO[b.cho]!) ?? 0) + 1);
      if (DOUBLE_CHO.has(b.cho)) compound++;
    } else if (a.jung !== b.jung) {
      picked.jung.set(JUNG[b.jung]!, (picked.jung.get(JUNG[b.jung]!) ?? 0) + 1);
      if (COMPOUND_JUNG.has(b.jung)) compound++;
    } else {
      expect(b.jong).not.toBe(0); // 받침을 없애지는 않는다
      picked.jong.set(JONG[b.jong]!, (picked.jong.get(JONG[b.jong]!) ?? 0) + 1);
      if (COMPOUND_JONG_ALL.has(b.jong)) compound++;
    }
  }
  const top = (m: Map<string, number>, k: number) =>
    [...m.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, k)
      .map(([j]) => j);
  return { compoundRate: compound / n, top, picked };
}

describe('트랜스레터 어려움 — 바뀌는 자모 분포', () => {
  it('보통은 쌍자음·겹모음·겹받침이 자주 나온다 (기존 그대로 고르게)', () => {
    expect(simulate('normal').compoundRate).toBeGreaterThan(0.2);
  });

  it('어려움은 쌍자음·겹모음·겹받침이 1% 아래로 줄어든다', () => {
    expect(simulate('hard').compoundRate).toBeLessThan(0.01);
  });

  it('어려움은 많이 쓰이는 자모로 주로 바뀐다', () => {
    const r = simulate('hard');
    const { top } = r;
    expect(top(r.picked.cho, 3).some((j) => ['ㅇ', 'ㄱ', 'ㅅ'].includes(j))).toBe(true);
    expect(top(r.picked.jung, 3).some((j) => ['ㅏ', 'ㅣ', 'ㅗ'].includes(j))).toBe(true);
    expect(top(r.picked.jong, 3).some((j) => ['ㄴ', 'ㅇ', 'ㄹ'].includes(j))).toBe(true);
    // 드문 자모(ㅋ 초성 2%)는 흔한 자모(ㅇ 초성 14.5%)보다 훨씬 적게 나온다
    expect((r.picked.cho.get('ㅇ') ?? 0) / (r.picked.cho.get('ㅋ') ?? 1)).toBeGreaterThan(3);
  });

  it('가중치 표 크기는 자모 배열과 같다', () => {
    expect(TL_HARD_WEIGHTS.cho).toHaveLength(CHO.length);
    expect(TL_HARD_WEIGHTS.jung).toHaveLength(JUNG.length);
    expect(TL_HARD_WEIGHTS.jong).toHaveLength(JONG.length);
    expect(TL_HARD_WEIGHTS.jong[0]).toBe(0);
  });

  it('난이도 값은 hard 만 어려움, 나머지는 보통', () => {
    expect(resolveTransletterDifficulty('hard')).toBe('hard');
    expect(resolveTransletterDifficulty(undefined)).toBe('normal');
    expect(resolveTransletterDifficulty('HARD')).toBe('normal');
  });
});

describe('방 설정이 판까지 전달된다', () => {
  const ROOM = 'tl-hard-room';
  const ids = ['tl-a', 'tl-b'];
  afterEach(() => {
    transletterRace.cleanup(ROOM);
    for (const id of ids) sessions.removeSession(`sock-${id}`);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function start(gameOptions?: Record<string, unknown>) {
    vi.useFakeTimers();
    const sockets = ids.map((id) => {
      sessions.linkToken(`sock-${id}`, id);
      return { id: `sock-${id}`, emit: vi.fn() };
    });
    const io = { in: () => ({ fetchSockets: async () => sockets }) } as unknown as IO;
    const players = ids.map(
      (id, i) => ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: Date.now() }) as Player,
    );
    transletterRace.init(io, ROOM, players, 'multi', Date.now(), null, vi.fn(), gameOptions);
    await vi.advanceTimersByTimeAsync(0);
    return sockets[0]!.emit.mock.calls.filter(([e]) => e === 'game:state').at(-1)?.[1]
      .gameData as WordRaceGameData;
  }

  it('어려움 방은 화면에 어려움 표시', async () => {
    expect((await start({ transletterDifficulty: 'hard' })).levelLabel).toBe('어려움');
  });

  it('설정이 없는 방(랭크·밴픽 등)은 보통', async () => {
    expect((await start()).levelLabel).toBeUndefined();
  });
});
