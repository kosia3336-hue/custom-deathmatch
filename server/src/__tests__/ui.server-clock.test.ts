import { describe, expect, it } from 'vitest';
import { estimateClockOffset, getServerClockOffset, serverNow, syncServerClock } from '../../../lib/serverClock';

describe('서버 시각 보정', () => {
  it('왕복이 가장 짧은 표본의 한가운데를 서버 응답 시각으로 본다', () => {
    // 기기 시계가 서버보다 3초 느리다. 첫 표본은 지연이 커서(편도 400ms) 오차가 흐리다.
    const offset = estimateClockOffset([
      { sentAt: 1000, receivedAt: 1800, serverNow: 4400 },
      { sentAt: 2000, receivedAt: 2040, serverNow: 5020 },
    ]);
    expect(offset).toBe(3000);
  });

  it('비정상 표본만 있으면 추정하지 않는다', () => {
    expect(estimateClockOffset([])).toBeNull();
    expect(estimateClockOffset([{ sentAt: 10, receivedAt: 5, serverNow: 100 }])).toBeNull();
    expect(estimateClockOffset([{ sentAt: 0, receivedAt: 5000, serverNow: 100 }])).toBeNull();
    expect(estimateClockOffset([{ sentAt: 0, receivedAt: 10, serverNow: NaN }])).toBeNull();
  });

  it('소켓으로 잰 오차를 serverNow 에 반영하고, 실패하면 이전 값을 유지한다', async () => {
    const skew = 7000;
    const ok = {
      connected: true,
      timeout: () => ({
        emit: (_e: 'time:sync', cb: (err: Error | null, v: number) => void) => cb(null, Date.now() + skew),
      }),
    };
    await syncServerClock(ok);
    expect(Math.abs(getServerClockOffset() - skew)).toBeLessThan(50);
    expect(Math.abs(serverNow() - (Date.now() + skew))).toBeLessThan(50);

    const failing = {
      connected: true,
      timeout: () => ({
        emit: (_e: 'time:sync', cb: (err: Error | null, v: number) => void) => cb(new Error('timeout'), 0),
      }),
    };
    await syncServerClock(failing);
    expect(Math.abs(getServerClockOffset() - skew)).toBeLessThan(50);
  });
});
