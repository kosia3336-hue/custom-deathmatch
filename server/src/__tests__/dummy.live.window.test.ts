import { describe, it, expect } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';
import { liveDummyTierFor, LIVE_DUMMY_TIER } from '@shared/dummy.js';
import {
  isTitanLiveWindow,
  isYeonseungLiveWindow,
  isLiveDummyEnabled,
  liveDummyTierForGame,
} from '../dummy/live/window.js';

describe('타이탄 활동 창', () => {
  it('2026-08-21 22:00 KST는 켜짐, 21:59는 꺼짐, 24:00(다음날 0시)는 꺼짐', () => {
    expect(isTitanLiveWindow(new Date('2026-08-21T12:59:00.000Z'))).toBe(false);
    expect(isTitanLiveWindow(new Date('2026-08-21T13:00:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-21T14:59:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-21T15:00:00.000Z'))).toBe(false);
  });

  it('평일·주말 모두 같은 밤 창', () => {
    expect(isTitanLiveWindow(new Date('2026-08-22T13:00:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-23T13:30:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-24T13:00:00.000Z'))).toBe(true);
    expect(isTitanLiveWindow(new Date('2026-08-24T12:59:00.000Z'))).toBe(false);
    expect(isTitanLiveWindow(new Date('2026-08-22T05:00:00.000Z'))).toBe(false);
  });

  it('사중력 사목만 하, 나머지는 기본 상', () => {
    expect(LIVE_DUMMY_TIER).toBe('상');
    expect(liveDummyTierForGame(GAME_IDS.FOUR_GRAVITY)).toBe('하');
    expect(liveDummyTierForGame(GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('상');
    expect(liveDummyTierForGame(GAME_IDS.QUATRO)).toBe('상');
    expect(liveDummyTierForGame(GAME_IDS.BAN_PICK)).toBe('상');
  });

  it('DUMMY_LIVE 없으면 비활성', () => {
    const prev = process.env.DUMMY_LIVE;
    delete process.env.DUMMY_LIVE;
    expect(isLiveDummyEnabled()).toBe(false);
    if (prev !== undefined) process.env.DUMMY_LIVE = prev;
  });
});

describe('최연승 활동 창', () => {
  it('매일 21:00 KST는 켜짐, 20:59·22:30은 꺼짐', () => {
    expect(isYeonseungLiveWindow(new Date('2026-08-24T11:59:00.000Z'))).toBe(false);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T12:00:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T13:29:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T13:30:00.000Z'))).toBe(false);
  });

  it('평일·주말 모두 같은 밤 창', () => {
    expect(isYeonseungLiveWindow(new Date('2026-08-21T12:10:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-22T12:10:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T12:10:00.000Z'))).toBe(true);
  });

  it('사목만 하, 나머지는 중', () => {
    expect(liveDummyTierFor('최연승', GAME_IDS.FOUR_GRAVITY)).toBe('하');
    expect(liveDummyTierFor('최연승', GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('중');
    expect(liveDummyTierFor('최연승', GAME_IDS.QUATRO)).toBe('중');
    expect(liveDummyTierFor('최연승', GAME_IDS.BAN_PICK)).toBe('중');
  });
});
