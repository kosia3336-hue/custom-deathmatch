/**
 * 조각조각 — 글자마다 자모 하나만 남은 조각으로 단어 맞히기, 7전 4승제.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  JG_REVEAL_MS,
  JG_ROUND_SEC,
  JG_WRONG_LOCK_MS,
  fitsPieces,
  makePieces,
  type JogakGameData,
} from '@shared/types/jogak.js';
import { jamoOf } from '@shared/lib/hangul.js';
import {
  cleanupJogak,
  handleJogakAction,
  initJogak,
  jogakPuzzlesOf,
} from '../socket/games/jogak/index.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { sessions } from '../store/sessions.js';

describe('조각 만들기', () => {
  it('글자마다 초·중·종성 중 하나를 남기고, 모두 모음이면 다시 고른다', () => {
    for (let i = 0; i < 200; i++) {
      const pieces = makePieces('방송국');
      expect(pieces).toHaveLength(3);
      pieces.forEach((p, k) => {
        const s = jamoOf('방송국'[k]!)!;
        expect([s.cho, s.jung, s.jong]).toContain(p);
      });
      expect(pieces.every((p) => /^[ㅏ-ㅣ]$/.test(p))).toBe(false);
    }
    // 무작위가 늘 모음만 고르면 첫 글자의 초성으로 바꾼다
    expect(makePieces('피자', () => 0.99)).toEqual(['ㅍ', 'ㅏ']);
  });

  it('조각에 들어맞는 단어 — 글자 수가 같고 글자마다 그 자모를 가진다', () => {
    expect(fitsPieces('피자', ['ㅍ', 'ㅏ'])).toBe(true);
    expect(fitsPieces('포도', ['ㅍ', 'ㅗ'])).toBe(true);
    expect(fitsPieces('피자', ['ㅈ', 'ㅏ'])).toBe(false);
    expect(fitsPieces('피자빵', ['ㅍ', 'ㅏ'])).toBe(false);
    expect(fitsPieces('국밥', ['ㄱ', 'ㅂ'])).toBe(true); // 국의 받침 ㄱ 도 맞는다
  });
});

const ROOM = 'jogak-room';
const ids = ['jg-a', 'jg-b'];

afterEach(() => {
  cleanupJogak(ROOM);
  for (const id of ids) sessions.removeSession(`sock-${id}`);
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setup(mode: PlayMode = 'multi') {
  vi.useFakeTimers();
  const sockets = ids.map((id) => {
    sessions.linkToken(`sock-${id}`, id);
    return { id: `sock-${id}`, emit: vi.fn() };
  });
  const io = {
    in: () => ({ fetchSockets: async () => sockets }),
    to: () => ({ emit: vi.fn() }),
  } as unknown as IO;
  const players = ids
    .slice(0, mode === 'solo' ? 1 : 2)
    .map(
      (id, i) => ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: Date.now() }) as Player,
    );
  const end = vi.fn();
  initJogak(io, ROOM, players, mode, Date.now(), null, end);
  const puzzles = jogakPuzzlesOf(ROOM)!;
  const submit = (who: number, round: number, word: string) =>
    handleJogakAction(io, sockets[who] as unknown as TypedSocket, ROOM, {
      type: 'submit',
      round,
      word,
    });
  const lastState = (who: number) =>
    sockets[who].emit.mock.calls.filter(([e]) => e === 'game:state').at(-1)?.[1]
      .gameData as JogakGameData;
  /** round 라운드를 who 가 맞히고 다음 라운드로 넘긴다 */
  const win = async (who: number, round: number) => {
    submit(who, round, puzzles[round - 1]!.answer);
    await vi.advanceTimersByTimeAsync(JG_REVEAL_MS);
  };
  return { sockets, submit, lastState, end, puzzles, win };
}

describe('조각조각 판', () => {
  it('7문제를 미리 정하고, 화면에는 지금 라운드 조각만 보낸다', async () => {
    const { lastState, puzzles } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(puzzles).toHaveLength(7);
    expect(new Set(puzzles.map((p) => p.answer)).size).toBe(7);
    for (const p of puzzles) {
      expect(p.accepts.has(p.answer)).toBe(true);
      for (const w of p.accepts) expect(fitsPieces(w, p.pieces)).toBe(true);
    }
    const view = lastState(0);
    expect(view.round).toBe(1);
    expect(view.pieces).toEqual(puzzles[0]!.pieces);
    expect(view.category).toBe(puzzles[0]!.category);
    expect(JSON.stringify(view)).not.toContain(puzzles[0]!.answer);
  });

  it('먼저 맞힌 사람이 1점, 정답을 공개한 뒤 다음 라운드', async () => {
    const { submit, lastState, puzzles } = setup();
    submit(1, 1, puzzles[0]!.answer);
    await vi.advanceTimersByTimeAsync(0);
    const v = lastState(0);
    expect(v.phase).toBe('reveal');
    expect(v.scores).toEqual({ 'jg-a': 0, 'jg-b': 1 });
    expect(v.history[0]).toMatchObject({ round: 1, answer: puzzles[0]!.answer, winnerId: 'jg-b' });
    // 공개 중에는 늦은 정답이 점수가 되지 않는다
    submit(0, 1, puzzles[0]!.answer);
    await vi.advanceTimersByTimeAsync(JG_REVEAL_MS);
    expect(lastState(0).round).toBe(2);
    expect(lastState(0).phase).toBe('playing');
    expect(lastState(0).scores['jg-a']).toBe(0);
  });

  it('오답이면 잠깐 잠기고, 지난 라운드 번호로 낸 답은 무시한다', async () => {
    const { submit, lastState, puzzles, sockets } = setup();
    submit(0, 1, '틀린단어');
    expect(
      sockets[0]!.emit.mock.calls.some(([e, d]) => e === 'error' && /땡/.test(d.message)),
    ).toBe(true);
    submit(0, 1, puzzles[0]!.answer); // 잠금 중
    await vi.advanceTimersByTimeAsync(0);
    expect(lastState(0).phase).toBe('playing');
    await vi.advanceTimersByTimeAsync(JG_WRONG_LOCK_MS);
    submit(0, 2, puzzles[0]!.answer); // 라운드 번호가 다르다
    await vi.advanceTimersByTimeAsync(0);
    expect(lastState(0).phase).toBe('playing');
    submit(0, 1, puzzles[0]!.answer);
    await vi.advanceTimersByTimeAsync(0);
    expect(lastState(0).scores['jg-a']).toBe(1);
  });

  it('시간 안에 아무도 못 맞히면 점수 없이 넘어간다', async () => {
    const { lastState } = setup();
    await vi.advanceTimersByTimeAsync(JG_ROUND_SEC * 1000);
    expect(lastState(0).history[0]?.winnerId).toBeNull();
    expect(lastState(0).scores).toEqual({ 'jg-a': 0, 'jg-b': 0 });
    await vi.advanceTimersByTimeAsync(JG_REVEAL_MS);
    expect(lastState(0).round).toBe(2);
  });

  it('4점을 먼저 따면 이긴다', async () => {
    const { win, lastState, end } = setup();
    await win(0, 1);
    await win(1, 2);
    await win(0, 3);
    await win(0, 4);
    await win(0, 5);
    const v = lastState(1);
    expect(v.phase).toBe('finished');
    expect(v.result?.winnerId).toBe('jg-a');
    await vi.advanceTimersByTimeAsync(3500);
    expect(end).toHaveBeenCalledOnce();
    expect(end.mock.calls[0]![2].rankings[0]).toMatchObject({
      playerId: 'jg-a',
      rank: 1,
      score: 4,
    });
  });

  it('남은 라운드로 따라잡을 수 없으면 바로 끝낸다', async () => {
    const { win, lastState } = setup();
    // 1~4R 아무도 못 맞힘, 5·6R a 승 → 2:0, 남은 1라운드로는 못 따라잡는다
    for (let r = 1; r <= 4; r++)
      await vi.advanceTimersByTimeAsync(JG_ROUND_SEC * 1000 + JG_REVEAL_MS);
    expect(lastState(0).round).toBe(5);
    await win(0, 5);
    await win(0, 6);
    expect(lastState(0).phase).toBe('finished');
    expect(lastState(0).result?.winnerId).toBe('jg-a');
  });

  it('7라운드가 끝나 동점이면 무승부', async () => {
    const { win, lastState } = setup();
    await win(0, 1);
    await win(1, 2);
    for (let r = 3; r <= 7; r++)
      await vi.advanceTimersByTimeAsync(JG_ROUND_SEC * 1000 + JG_REVEAL_MS);
    expect(lastState(0).phase).toBe('finished');
    expect(lastState(0).result?.winnerId).toBeNull();
  });

  it('솔로는 7라운드를 모두 푼다', async () => {
    const { win, lastState, end } = setup('solo');
    for (let r = 1; r <= 5; r++) await win(0, r);
    expect(lastState(0).phase).toBe('playing');
    expect(Object.keys(lastState(0).players)).toEqual(['jg-a']);
    await win(0, 6);
    await vi.advanceTimersByTimeAsync(JG_ROUND_SEC * 1000);
    expect(lastState(0).result?.reason).toBe('7문제 중 6문제 정답');
    await vi.advanceTimersByTimeAsync(3500);
    expect(end.mock.calls[0]![2].rankings).toEqual([
      { playerId: 'jg-a', nickname: 'jg-a', rank: 1, score: 6 },
    ]);
  });
});
