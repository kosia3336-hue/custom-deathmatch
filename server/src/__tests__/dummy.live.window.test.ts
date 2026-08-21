import { describe, it, expect } from 'vitest';
import { isTitanLiveWindow, isLiveDummyEnabled } from '../dummy/live/window.js';

describe('타이탄 활동 창', () => {
  it('2026-08-21 22:00 KST는 켜짐, 21:59는 꺼짐, 24:00(다음날 0시)는 꺼짐', () => {
    expect(isTitanLiveWindow(new Date('2026-08-21T12:59:00.000Z'))).toBe(false);
    expect(isTitanLiveWindow(new Date('2026-08-21T13:00:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-21T14:59:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-21T15:00:00.000Z'))).toBe(false);
  });

  it('토·일도 같은 밤 창만', () => {
    expect(isTitanLiveWindow(new Date('2026-08-22T13:00:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-23T13:30:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-22T05:00:00.000Z'))).toBe(false);
  });

  it('그다음 주 월요일은 꺼짐', () => {
    expect(isTitanLiveWindow(new Date('2026-08-24T13:00:00.000Z'))).toBe(false);
  });

  it('DUMMY_LIVE 없으면 비활성', () => {
    const prev = process.env.DUMMY_LIVE;
    delete process.env.DUMMY_LIVE;
    expect(isLiveDummyEnabled()).toBe(false);
    if (prev !== undefined) process.env.DUMMY_LIVE = prev;
  });
});
