import { describe, it, expect, vi } from 'vitest';
import { initBNW2 } from '../socket/games/bnw2/index.js';
import { gameStates, processFirstSubmit, processSecondSubmit } from '../socket/games/bnw2/state.js';

/* 규칙 K — 둘 다 잔여포인트 0, 최종 승점도 같으면 선플레이어가 승리한다. */

const io = {
  to: () => ({ emit: () => {} }),
  in: () => ({ fetchSockets: async () => [] }),
  emit: () => {},
} as never;

function startGame() {
  const ended = vi.fn();
  initBNW2(
    io,
    'room-k',
    [
      { id: 'A', nickname: '가', isHost: true, isReady: true, joinedAt: 1 },
      { id: 'B', nickname: '나', isHost: false, isReady: true, joinedAt: 2 },
    ] as never,
    'multi',
    Date.now(),
    null,
    ended as never,
  );
  const s = gameStates.get('room-k')!;
  return { s, ended };
}

describe('흑과백2 규칙 K — 완전 동점', () => {
  it('둘 다 0점이 되고 승점도 같으면 선플레이어가 1위다', () => {
    vi.useFakeTimers();
    const { s, ended } = startGame();

    /* 마지막 한 판만 남은 상태로 맞춘다 — 승점 동률, 잔여 포인트도 같다. */
    s.player1.score = 3;
    s.player2.score = 3;
    s.player1.remainingPoints = 10;
    s.player2.remainingPoints = 10;
    expect(s.firstPlayerId).toBe('A');

    /* 같은 값을 내면 그 라운드는 비기고, 둘 다 잔여 0 이 된다. */
    processFirstSubmit(io, s, 10);
    processSecondSubmit(io, s, 10);

    expect(s.gameOver).toBe(true);
    expect(s.winType).toBe('draw');
    expect(s.winner).toBe('A');

    vi.runAllTimers();
    const payload = ended.mock.calls[0]?.[2] as {
      rankings: Array<{ playerId: string; rank: number }>;
    };
    const rankOf = (id: string) => payload.rankings.find((r) => r.playerId === id)?.rank;
    expect(rankOf('A')).toBe(1);
    expect(rankOf('B')).toBe(2);
    vi.useRealTimers();
  });

  it('라운드의 선이 바뀌어도 승자는 게임 시작 시의 선공이다', () => {
    vi.useFakeTimers();
    const { s } = startGame();
    s.player1.remainingPoints = 30;
    s.player2.remainingPoints = 30;

    /* 1R — 선 A(10) vs 후 B(20) → B 승. 다음 라운드 선은 B 가 된다. */
    processFirstSubmit(io, s, 10);
    processSecondSubmit(io, s, 20);
    vi.advanceTimersByTime(6000);
    expect(s.firstPlayerId).toBe('B');
    expect([s.player1.score, s.player2.score]).toEqual([0, 1]);

    /* 2R — 선 B(10, 전부) vs 후 A(20, 전부) → A 승. 승점 1:1, 둘 다 잔여 0. */
    processFirstSubmit(io, s, 10);
    processSecondSubmit(io, s, 20);

    expect(s.player1.remainingPoints).toBe(0);
    expect(s.player2.remainingPoints).toBe(0);
    expect(s.player1.score).toBe(s.player2.score);
    expect(s.winType).toBe('draw');
    /*
      마지막 라운드의 선은 B 였지만, 규칙 K 가 가리키는 선플레이어는 게임 시작 시의
      선공 A 다. 마지막 판을 이겨 동점을 만든 A 가 지는 일은 없어야 한다.
    */
    expect(s.firstPlayerId).toBe('B');
    expect(s.winner).toBe('A');
    vi.useRealTimers();
  });
});
