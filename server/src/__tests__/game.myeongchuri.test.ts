import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkMyeongchuriAnswer,
  dealMyeongchuriTiles,
  evaluateMyeongchuri,
  myeongchuriTileToken,
  randomMyeongchuriLetters,
  resolveMyeongchuriOptions,
} from '@shared/logic/myeongchuri.js';
import {
  MYEONGCHURI_LETTERS,
  MYEONGCHURI_SYMBOLS,
  type MyeongchuriLetter,
  type MyeongchuriSymbol,
  type MyeongchuriTile,
} from '@shared/types/myeongchuri.js';
import type { Player } from '@shared/types/room.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  cleanupMyeongchuri,
  handleMyeongchuriAction,
  initMyeongchuri,
} from '../socket/games/myeongchuri/index.js';
import { myeongchuriStates, toMyeongchuriGameData } from '../socket/games/myeongchuri/state.js';
import { sessions } from '../store/sessions.js';

const n = (value: number): MyeongchuriTile => ({ kind: 'number', value });
const s = (value: MyeongchuriSymbol): MyeongchuriTile => ({ kind: 'symbol', value });
const evalOf = (...tiles: MyeongchuriTile[]) => evaluateMyeongchuri(tiles);

describe('명추리 계산', () => {
  it('룰 원문 예시', () => {
    expect(evalOf(n(6), n(5), s('+'), n(4))).toEqual({ value: '69', hidden: null });
    expect(evalOf(s('×'), n(6), n(5), n(4))).toEqual({ value: null, hidden: 'numbers' });
    expect(evalOf(n(4), s('+'), n(5), s('^'))).toEqual({ value: '9', hidden: null });
    expect(evalOf(n(5), s('Max'), s('+'), n(9))).toEqual({ value: '14', hidden: null });
    expect(evalOf(n(6), n(7), n(8), n(9))).toEqual({ value: null, hidden: 'numbers' });
  });

  it('맨 앞·뒤 기호와 붙은 기호 사이에는 1을 넣고, 음수는 그대로 낸다', () => {
    expect(evalOf(s('-'), n(7), s('Min'), n(3)).value).toBe('-2');
    expect(evalOf(n(3), s('×'), s('-'), n(4)).value).toBe('-1');
    expect(evalOf(s('+'), s('×'), n(5), n(6)).value).toBe('57');
    expect(evalOf(n(2), s('^'), n(3), s('^')).value).toBe('8');
  });

  it('우선순위는 Max·Min > ^ > / > × > +·- 이고, 같으면 앞에서부터', () => {
    expect(evalOf(n(4), s('/'), s('^'), n(5)).value).toBe('4');
    expect(evalOf(n(9), s('/'), n(2), s('×')).value).toBe('4');
    expect(evalOf(n(7), s('-'), n(3), s('×')).value).toBe('4');
    expect(evalOf(n(2), s('×'), n(3), s('^')).value).toBe('6');
    expect(evalOf(n(8), s('/'), n(3), s('Max')).value).toBe('2');
    expect(evalOf(n(9), s('^'), n(8), n(7)).value).toBe((9n ** 87n).toString());
  });

  it('기호 3개 이상이 붙으면 비공개', () => {
    expect(evalOf(s('+'), s('×'), s('-'), n(4)).hidden).toBe('symbols');
    expect(evalOf(s('+'), s('×'), s('-'), s('^')).hidden).toBe('symbols');
  });
});

describe('명추리 타일', () => {
  it('서로 다른 숫자 5개(1~9)와 서로 다른 기호 4개를 A~I 에 놓는다', () => {
    for (let i = 0; i < 300; i += 1) {
      const tiles = dealMyeongchuriTiles();
      const values = MYEONGCHURI_LETTERS.map((letter) => tiles[letter]);
      const numbers = values.flatMap((tile) => (tile.kind === 'number' ? [tile.value] : []));
      const symbols = values.flatMap((tile) => (tile.kind === 'symbol' ? [tile.value] : []));
      expect(numbers).toHaveLength(5);
      expect(new Set(numbers).size).toBe(5);
      expect(numbers.every((value) => value >= 1 && value <= 9)).toBe(true);
      expect(symbols).toHaveLength(4);
      expect(new Set(symbols).size).toBe(4);
      expect(symbols.every((value) => (MYEONGCHURI_SYMBOLS as readonly string[]).includes(value))).toBe(true);
    }
  });

  it('답 확인·무작위 알파벳·생각 시간 기본값', () => {
    const tiles = dealMyeongchuriTiles();
    const answer = Object.fromEntries(MYEONGCHURI_LETTERS.map((letter) => [letter, myeongchuriTileToken(tiles[letter])]));
    expect(checkMyeongchuriAnswer(tiles, answer)).toBe(true);
    expect(checkMyeongchuriAnswer(tiles, { ...answer, A: answer.A === '1' ? '2' : '1' })).toBe(false);
    const picked = randomMyeongchuriLetters(['A', 'B'], 2);
    expect(picked).toHaveLength(2);
    expect(picked).not.toContain('A');
    expect(new Set(picked).size).toBe(2);
    expect(resolveMyeongchuriOptions({})).toEqual({ thinkEnabled: true, thinkSeconds: 120 });
    expect(resolveMyeongchuriOptions({ thinkEnabled: false, thinkSeconds: 9999 })).toEqual({
      thinkEnabled: false,
      thinkSeconds: 600,
    });
  });
});

const roomIds = new Set<string>();
const socketIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupMyeongchuri(roomId);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
  vi.useRealTimers();
});

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: false, isReady: true, joinedAt: Date.now() };
}

function ioStub() {
  return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
}

function socketFor(playerId: string) {
  const socketId = `socket-${playerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, playerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket;
}

/** A=6 B=5 C=+ D=4 E=× F=7 G=- H=Max I=9 */
const FIXED: Record<MyeongchuriLetter, MyeongchuriTile> = {
  A: n(6),
  B: n(5),
  C: s('+'),
  D: n(4),
  E: s('×'),
  F: n(7),
  G: s('-'),
  H: s('Max'),
  I: n(9),
};
const FIXED_ANSWER = Object.fromEntries(
  MYEONGCHURI_LETTERS.map((letter) => [letter, myeongchuriTileToken(FIXED[letter])]),
);
const WRONG_ANSWER = { ...FIXED_ANSWER, A: '9', I: '6' };

function start(roomId: string, options: { timeLimit?: number | null; gameOptions?: Record<string, unknown> } = {}) {
  vi.useFakeTimers();
  roomIds.add(roomId);
  const first = player(`${roomId}-a`, '선');
  const second = player(`${roomId}-b`, '후');
  const io = ioStub();
  const onEnd = vi.fn();
  initMyeongchuri(io, roomId, [first, second], 'multi', Date.now(), options.timeLimit ?? null, onEnd, options.gameOptions ?? {});
  const state = myeongchuriStates.get(roomId)!;
  state.tiles = { ...FIXED };
  const act = (socket: TypedSocket, data: Record<string, unknown>) =>
    handleMyeongchuriAction(io, socket, roomId, data);
  return { state, first, second, a: socketFor(first.id), b: socketFor(second.id), onEnd, act };
}

describe('명추리 진행', () => {
  it('선이 앞 두 칸, 후가 뒤 두 칸을 고르면 결과를 알리고 다음 라운드는 선후가 바뀐다', () => {
    const { state, first, second, a, b, act } = start('mc-round', { gameOptions: { thinkEnabled: false } });
    expect(state.phase).toBe('pick-first');
    expect(state.currentPlayerId).toBe(first.id);

    act(b, { type: 'pick', letters: ['A', 'B'] });
    expect(state.picks).toEqual([]);

    act(a, { type: 'pick', letters: ['A', 'B'] });
    expect(state.phase).toBe('pick-second');
    expect(state.currentPlayerId).toBe(second.id);

    act(b, { type: 'pick', letters: ['A', 'D'] });
    expect(state.picks).toEqual(['A', 'B']);
    expect(b.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('같은 알파벳') }));

    act(b, { type: 'pick', letters: ['C', 'D'] });
    expect(state.rounds[0]).toMatchObject({
      round: 1,
      letters: ['A', 'B', 'C', 'D'],
      value: '69',
      hidden: null,
      firstPlayerId: first.id,
    });
    expect(state.round).toBe(2);
    expect(state.firstPlayerId).toBe(second.id);
    expect(state.currentPlayerId).toBe(second.id);
    expect(state.phase).toBe('pick-first');
  });

  it('생각 시간은 두 사람이 모두 건너뛰기를 눌러야 넘어가고, 누르지 않으면 시간이 끝날 때 넘어간다', async () => {
    const { state, a, b, act } = start('mc-think');
    act(a, { type: 'pick', letters: ['A', 'B'] });
    act(b, { type: 'pick', letters: ['C', 'D'] });
    expect(state.phase).toBe('thinking');
    expect(state.phaseSeconds).toBe(120);

    act(a, { type: 'skip-think' });
    expect(state.phase).toBe('thinking');
    act(b, { type: 'skip-think' });
    expect(state.phase).toBe('pick-first');
    expect(state.round).toBe(2);

    act(b, { type: 'pick', letters: ['E', 'F'] });
    act(a, { type: 'pick', letters: ['G', 'H'] });
    expect(state.phase).toBe('thinking');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state.round).toBe(3);
    expect(state.phase).toBe('pick-first');
  });

  it('고르는 시간이 끝나면 남은 알파벳에서 무작위로 놓는다', async () => {
    const { state, a, act } = start('mc-timeout', { timeLimit: 30, gameOptions: { thinkEnabled: false } });
    act(a, { type: 'pick', letters: ['A', 'B'] });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.rounds).toHaveLength(1);
    const [round] = state.rounds;
    expect(round.letters.slice(0, 2)).toEqual(['A', 'B']);
    expect(new Set(round.letters).size).toBe(4);
    expect(round.randomFirst).toBe(false);
    expect(round.randomSecond).toBe(true);
  });

  it('명추리는 상대 차례에도 선언할 수 있고, 성공하면 선언한 사람이 이긴다', async () => {
    const { state, second, b, onEnd, act } = start('mc-win');
    act(b, { type: 'declare' });
    expect(state.declaration?.playerId).toBe(second.id);
    act(b, { type: 'answer', answer: FIXED_ANSWER });
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0]?.[2]?.rankings?.[0]).toMatchObject({ playerId: second.id, rank: 1 });
  });

  it('실패하면 경고 1회·차례는 그대로·진행 시간 10초 추가, 경고 2회면 상대가 이긴다', () => {
    const { state, first, second, a, act } = start('mc-fail', { timeLimit: 180 });
    expect(state.phaseSeconds).toBe(180);
    act(a, { type: 'declare' });
    expect(state.phaseSeconds).toBe(190);

    act(a, { type: 'declare' });
    expect(a.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('이미 명추리') }));

    act(a, { type: 'answer', answer: WRONG_ANSWER });
    expect(state.warnings[first.id]).toBe(1);
    expect(state.gameOver).toBe(false);
    expect(state.phase).toBe('pick-first');
    expect(state.currentPlayerId).toBe(first.id);

    act(a, { type: 'declare' });
    act(a, { type: 'answer', answer: WRONG_ANSWER });
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
  });

  it('명추리 제출 시간 1분을 넘기면 오답으로 처리한다', async () => {
    const { state, second, b, act } = start('mc-declare-timeout');
    act(b, { type: 'declare' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.declaration).toBeNull();
    expect(state.warnings[second.id]).toBe(1);
    expect(state.declarations.at(-1)).toMatchObject({ playerId: second.id, success: false, timedOut: true });
  });

  it('선언하지 않은 사람은 답을 낼 수 없고, 빈칸이 있는 답은 받지 않는다', () => {
    const { state, first, a, b, act } = start('mc-answer-guard');
    act(a, { type: 'declare' });
    act(b, { type: 'answer', answer: FIXED_ANSWER });
    expect(state.gameOver).toBe(false);
    act(a, { type: 'answer', answer: { ...FIXED_ANSWER, I: '' } });
    expect(state.declaration?.playerId).toBe(first.id);
    expect(state.warnings[first.id]).toBe(0);
  });

  it('타일은 게임이 끝나야 공개한다', () => {
    const { state, a, act } = start('mc-reveal');
    expect(toMyeongchuriGameData(state, state.players[0].id).tiles).toBeNull();
    act(a, { type: 'declare' });
    act(a, { type: 'answer', answer: FIXED_ANSWER });
    expect(toMyeongchuriGameData(state, null).tiles?.A).toEqual(n(6));
  });
});

describe('명추리 1:1 솔로', () => {
  /** 솔로 방은 플레이어가 한 명이고 시간 제한이 없다(server/src/socket/room.ts) */
  function startSolo(roomId: string) {
    vi.useFakeTimers();
    roomIds.add(roomId);
    const only = player(`${roomId}-solo`, '혼자');
    const io = ioStub();
    const onEnd = vi.fn();
    initMyeongchuri(io, roomId, [only], 'solo', Date.now(), null, onEnd, {});
    const state = myeongchuriStates.get(roomId)!;
    state.tiles = { ...FIXED };
    const socket = socketFor(only.id);
    return {
      state,
      only,
      onEnd,
      act: (data: Record<string, unknown>) => handleMyeongchuriAction(io, socket, roomId, data),
    };
  }

  it('한 명으로 시작해 선·후 두 자리를 모두 두고, 생각 시간은 두지 않는다', () => {
    const { state, only, act } = startSolo('mc-solo-round');
    expect(state.players[0].id).toBe(only.id);
    expect(state.players[1].id).toBe(only.id);
    expect(state.thinkEnabled).toBe(false);
    expect(state.pickSeconds).toBeNull();
    expect(toMyeongchuriGameData(state, only.id).isSolo).toBe(true);

    act({ type: 'pick', letters: ['A', 'B'] });
    expect(state.phase).toBe('pick-second');
    expect(state.currentPlayerId).toBe(only.id);

    act({ type: 'pick', letters: ['C', 'D'] });
    expect(state.rounds[0]).toMatchObject({ letters: ['A', 'B', 'C', 'D'], value: '69' });
    // 생각 시간 없이 바로 다음 라운드로 넘어간다
    expect(state.phase).toBe('pick-first');
    expect(state.round).toBe(2);
  });

  it('명추리에 성공하면 순위는 한 줄이고 1점이다', async () => {
    const { state, only, onEnd, act } = startSolo('mc-solo-win');
    act({ type: 'declare' });
    act({ type: 'answer', answer: FIXED_ANSWER });
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(only.id);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onEnd.mock.calls[0]?.[2]?.rankings).toEqual([
      { playerId: only.id, nickname: '혼자', rank: 1, score: 1 },
    ]);
  });

  it('경고 2회면 이길 상대가 없으므로 승자 없이 끝나고 0점이다', async () => {
    const { state, only, onEnd, act } = startSolo('mc-solo-fail');
    act({ type: 'declare' });
    act({ type: 'answer', answer: WRONG_ANSWER });
    expect(state.gameOver).toBe(false);
    expect(state.warnings[only.id]).toBe(1);

    act({ type: 'declare' });
    act({ type: 'answer', answer: WRONG_ANSWER });
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBeNull();
    await vi.advanceTimersByTimeAsync(3000);
    expect(onEnd.mock.calls[0]?.[2]?.rankings).toEqual([
      { playerId: only.id, nickname: '혼자', rank: 1, score: 0 },
    ]);
  });
});
