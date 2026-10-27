/**
 * 단어조합 — 7전 4승제. 라운드마다 먼저 맞힌 사람이 1점, 4점을 먼저 따거나
 * 남은 라운드로 뒤집을 수 없으면 바로 끝난다. 솔로는 7라운드를 모두 푼다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  WP_REVEAL_MS,
  WP_ROUND_SECONDS,
  WP_TOTAL_ROUNDS,
  WP_WIN_SCORE,
  type WordPuzzleGameData,
} from '@shared/types/word-puzzle.js';
import {
  cleanupWordPuzzle,
  handleWordPuzzleAction,
  initWordPuzzle,
  wordPuzzleAnswerOf,
} from '../socket/games/word-puzzle/index.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { sessions } from '../store/sessions.js';

const ROOM = 'wp-bo7-room';
const ids = ['wp-a', 'wp-b'];

afterEach(() => {
  cleanupWordPuzzle(ROOM);
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
  initWordPuzzle(io, ROOM, players, mode, Date.now(), null, end);
  const lastState = () =>
    sockets[0]!.emit.mock.calls.filter(([e]) => e === 'game:state').at(-1)?.[1]
      .gameData as WordPuzzleGameData;
  /** 이번 판에 나온 정답들 */
  const answers: string[][] = [];
  /** 지금 라운드를 who 가 맞히고 다음 라운드로 넘긴다 */
  const win = async (who: number) => {
    const words = [...wordPuzzleAnswerOf(ROOM)!];
    answers.push(words);
    handleWordPuzzleAction(io, sockets[who] as unknown as TypedSocket, ROOM, {
      type: 'submit',
      words,
    });
    await vi.advanceTimersByTimeAsync(WP_REVEAL_MS);
  };
  /** 아무도 못 맞히고 시간이 지나 다음 라운드로 넘긴다 */
  const timeout = async () => {
    answers.push([...wordPuzzleAnswerOf(ROOM)!]);
    await vi.advanceTimersByTimeAsync(WP_ROUND_SECONDS * 1000 + WP_REVEAL_MS);
  };
  return { lastState, end, win, timeout, answers };
}

describe('단어조합 7전 4승제', () => {
  it('7라운드·4승을 화면에 알린다', async () => {
    const { lastState } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(WP_TOTAL_ROUNDS).toBe(7);
    expect(WP_WIN_SCORE).toBe(4);
    expect(lastState()).toMatchObject({ round: 1, totalRounds: 7, winScore: 4 });
  });

  it('4점을 먼저 따면 남은 라운드 없이 이긴다', async () => {
    const { win, lastState, end } = setup();
    await win(0);
    await win(1);
    await win(0);
    await win(0);
    expect(lastState().phase).toBe('playing');
    await win(0);
    expect(lastState().phase).toBe('finished');
    expect(lastState().scores).toEqual({ 'wp-a': 4, 'wp-b': 1 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(end.mock.calls[0]![2].rankings[0]).toMatchObject({
      playerId: 'wp-a',
      rank: 1,
      score: 4,
    });
  });

  it('남은 라운드로 따라잡을 수 없으면 바로 끝낸다', async () => {
    const { win, timeout, lastState } = setup();
    for (let r = 1; r <= 4; r++) await timeout();
    expect(lastState().round).toBe(5);
    await win(0);
    await win(0); // 2:0, 남은 1라운드로는 못 따라잡는다
    expect(lastState().phase).toBe('finished');
  });

  it('7라운드가 끝나 동점이면 무승부', async () => {
    const { win, timeout, lastState, end } = setup();
    await win(0);
    await win(1);
    for (let r = 3; r <= 7; r++) await timeout();
    expect(lastState().phase).toBe('finished');
    await vi.advanceTimersByTimeAsync(3000);
    expect(end.mock.calls[0]![2].rankings.map((r: { rank: number }) => r.rank)).toEqual([1, 1]);
  });

  it('솔로는 4점을 따도 7라운드를 모두 푼다', async () => {
    const { win, lastState } = setup('solo');
    for (let r = 1; r <= 6; r++) await win(0);
    expect(lastState().phase).toBe('playing');
    expect(lastState().round).toBe(7);
    await win(0);
    expect(lastState().phase).toBe('finished');
  });

  it('한 판 안에서 같은 단어가 다시 나오지 않는다', async () => {
    const { timeout, answers } = setup();
    for (let r = 1; r <= 7; r++) await timeout();
    const all = answers.flat();
    expect(all).toHaveLength(21);
    expect(new Set(all).size).toBe(21);
  });
});
