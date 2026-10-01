import { describe, expect, it, vi, afterEach } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { IO } from '../socket/types.js';
import { inputPhaseClock } from '../socket/gameClock.js';
import { initWinningStreak, cleanupWinningStreak } from '../socket/games/winning-streak/index.js';
import { gameStates, trySubmitCard } from '../socket/games/winning-streak/state.js';

const LIMIT = 180;

afterEach(() => {
  cleanupWinningStreak('clock-room');
  vi.useRealTimers();
});

describe('착수 단계에서만 시계를 보낸다', () => {
  it('착수 단계가 아니면 기준 시각을 주지 않는다', () => {
    expect(inputPhaseClock(LIMIT, 'cardSelect', ['cardSelect'], 1000)).toBe(1000);
    expect(inputPhaseClock(LIMIT, 'reveal', ['cardSelect'], 1000)).toBeNull();
    expect(inputPhaseClock(LIMIT, 'finished', ['cardSelect'], 1000)).toBeNull();
  });

  it('제한시간이 없으면 어느 단계든 주지 않는다', () => {
    expect(inputPhaseClock(null, 'cardSelect', ['cardSelect'], 1000)).toBeNull();
    expect(inputPhaseClock(0, 'cardSelect', ['cardSelect'], 1000)).toBeNull();
  });

  /*
    '3분짜리인데 2분 5초에서 시작한다' 는 신고의 실체.

    공개 단계에도 앞 라운드의 기준 시각을 계속 보내면, 상단 바는 아무도 착수를
    기다리지 않는 구간에서 숫자를 계속 깎는다. 50초 쓴 라운드라면 공개 중에
    2:05 언저리가 떠 있고, 다음 라운드가 시작되면 3:00 으로 되돌아간다.
    사용자에게는 새 라운드가 2:05 에서 시작한 것으로 보인다.
  */
  it('공개 단계에서는 앞 라운드의 남은 시간을 계속 깎지 않는다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    const seen: { phase: string; round: number; turnStartedAt: number | null }[] = [];
    const io = {
      in: () => ({
        fetchSockets: async () => [{
          id: 's1',
          emit: (ev: string, payload: { gameData: { phase: string; round: number }; turnStartedAt: number | null }) => {
            if (ev === 'game:state') {
              seen.push({ phase: payload.gameData.phase, round: payload.gameData.round, turnStartedAt: payload.turnStartedAt });
            }
          },
        }],
      }),
      to: () => ({ emit: () => {} }),
    } as unknown as IO;

    const players: Player[] = [
      { id: 'p1', nickname: '나', isHost: true, isReady: true, joinedAt: 0 },
      { id: 'p2', nickname: '상대', isHost: false, isReady: true, joinedAt: 0 },
    ];
    initWinningStreak(io, 'clock-room', players, 'multi', Date.now(), LIMIT, () => {});
    await vi.advanceTimersByTimeAsync(10);

    const roundStart = seen.at(-1)!.turnStartedAt!;
    expect(LIMIT - (Date.now() - roundStart) / 1000).toBeCloseTo(LIMIT, 0);

    // 50초를 쓰고 양쪽 제출 → 공개 단계
    await vi.advanceTimersByTimeAsync(50_000);
    const state = gameStates.get('clock-room')!;
    trySubmitCard(io, state, 'p1', 'spade');
    trySubmitCard(io, state, 'p2', 'heart');
    await vi.advanceTimersByTimeAsync(10);

    const onReveal = seen.at(-1)!;
    expect(onReveal.phase).toBe('reveal');
    // 예전에는 여기서 앞 라운드 시각이 그대로 실려 2:05 까지 깎였다.
    expect(onReveal.turnStartedAt).toBeNull();

    // 공개가 끝나고 새 라운드는 제한시간 그대로 시작한다
    await vi.advanceTimersByTimeAsync(5_500);
    const nextRound = seen.at(-1)!;
    expect(nextRound.round).toBe(2);
    expect(nextRound.phase).toBe('cardSelect');
    expect(LIMIT - (Date.now() - nextRound.turnStartedAt!) / 1000).toBeGreaterThan(LIMIT - 1);
  });
});
