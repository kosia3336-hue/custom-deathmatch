import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_PLAYER_ID } from '../../../shared/types/room';
import {
  initWinningStreak,
  handleWinningStreakAction,
  getWinningStreakState,
  cleanupWinningStreak,
} from '../socket/games/winning-streak/index';
import { getAvailableCards } from '../socket/games/winning-streak/state';
import {
  initSilperBnw,
  handleSilperBnwAction,
  getSilperBnwState,
  cleanupSilperBnw,
} from '../socket/games/silper-bnw/index';

const room = 'com-completion';
const viewer = { id: 'human', emit: vi.fn() } as any;
const io = { in: () => ({ fetchSockets: async () => [viewer] }) } as any;
const players = [
  { id: 'human', nickname: '나' },
  { id: AI_PLAYER_ID, nickname: 'AI' },
] as any;

afterEach(() => {
  cleanupWinningStreak(room);
  cleanupSilperBnw(room);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  viewer.emit.mockClear();
});

describe('COM 경기 종료 알림', () => {
  it('연승게임은 실제 AI와 마지막 라운드까지 진행한 뒤 종료 콜백을 한 번 호출한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ended = vi.fn();
    initWinningStreak(io, room, players, 'com', Date.now(), null, ended);
    for (let step = 0; step < 30 && !ended.mock.calls.length; step++) {
      const state = getWinningStreakState(room);
      if (state?.phase === 'cardSelect') {
        handleWinningStreakAction(io, viewer, room, {
          type: 'selectCard',
          card: getAvailableCards(state.player1)[0],
        });
      }
      await vi.advanceTimersByTimeAsync(6000);
    }
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended.mock.calls[0][2].rankings).toHaveLength(2);
    expect(ended.mock.calls[0][2].gameResultData.roundHistory).toHaveLength(10);
    expect(viewer.emit).toHaveBeenCalledWith(
      'game:state',
      expect.objectContaining({ gameData: expect.objectContaining({ phase: 'finished' }) }),
    );
  });
  it('실퍼는 실제 AI의 선·후 제출과 경기 정산을 거쳐 종료 콜백을 한 번 호출한다', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ended = vi.fn();
    initSilperBnw(io, room, players, 'com', Date.now(), null, ended);
    for (let step = 0; step < 100 && !ended.mock.calls.length; step++) {
      const state = getSilperBnwState(room);
      if (state && !state.gameOver) {
        const myTurn =
          (state.phase === 'firstSubmit' && state.firstPlayerId === viewer.id) ||
          (state.phase === 'secondSubmit' && state.firstPlayerId !== viewer.id);
        if (myTurn) {
          const tile = Object.entries(state.player1.tiles).find(([, count]) => count > 0)![0];
          handleSilperBnwAction(io, viewer, room, {
            type: state.phase === 'firstSubmit' ? 'submitFirst' : 'submitSecond',
            tiles: [Number(tile)],
          });
        }
      }
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended.mock.calls[0][2].rankings).toHaveLength(2);
    expect(ended.mock.calls[0][2].gameResultData.totalRounds).toBeGreaterThan(0);
    expect(viewer.emit).toHaveBeenCalledWith(
      'game:state',
      expect.objectContaining({ gameData: expect.objectContaining({ phase: 'finished' }) }),
    );
  });
});
