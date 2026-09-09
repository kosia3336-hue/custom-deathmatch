import { describe, it, expect } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';
import { liveDummyTierFor, LIVE_DUMMY_TIER } from '@shared/dummy.js';
import {
  isTitanLiveWindow,
  isYeonseungLiveWindow,
  isJackLiveWindow,
  isIronhyunseongLiveWindow,
  isLiveDummyEnabled,
  isLiveDummyRankEnabled,
  liveDummyTierForGame,
} from '../dummy/live/window.js';
import { isMinsInLiveWindow } from '../dummy/live/roster.js';

describe('타이탄 활동 창', () => {
  it('off — 예전 창 시각에도 꺼짐', () => {
    expect(isTitanLiveWindow(new Date('2026-08-21T13:00:00.000Z'))).toBe(false);
    expect(isTitanLiveWindow(new Date('2026-08-24T13:00:00.000Z'))).toBe(false);
    expect(isTitanLiveWindow(new Date('2026-08-22T13:00:00.000Z'))).toBe(false);
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

  it('DUMMY_LIVE_RANK 없으면 랭크 큐 비활성', () => {
    const prev = process.env.DUMMY_LIVE_RANK;
    delete process.env.DUMMY_LIVE_RANK;
    expect(isLiveDummyRankEnabled()).toBe(false);
    process.env.DUMMY_LIVE_RANK = '1';
    expect(isLiveDummyRankEnabled()).toBe(true);
    if (prev === undefined) delete process.env.DUMMY_LIVE_RANK;
    else process.env.DUMMY_LIVE_RANK = prev;
  });
});

describe('최연승 활동 창', () => {
  it('평일 21:00–23:00 KST. 20:59·23:00은 꺼짐', () => {
    expect(isYeonseungLiveWindow(new Date('2026-08-24T11:59:00.000Z'))).toBe(false);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T12:00:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T13:30:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T13:59:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T14:00:00.000Z'))).toBe(false);
  });

  it('토·일은 꺼짐. 금 밤은 켜지고 토 새벽은 끊긴다', () => {
    expect(isYeonseungLiveWindow(new Date('2026-08-21T12:10:00.000Z'))).toBe(true);
    expect(isYeonseungLiveWindow(new Date('2026-08-21T14:00:00.000Z'))).toBe(false);
    expect(isYeonseungLiveWindow(new Date('2026-08-22T12:10:00.000Z'))).toBe(false);
    expect(isYeonseungLiveWindow(new Date('2026-08-24T12:10:00.000Z'))).toBe(true);
  });

  it('사목만 하, 나머지는 중', () => {
    expect(liveDummyTierFor('최연승', GAME_IDS.FOUR_GRAVITY)).toBe('하');
    expect(liveDummyTierFor('최연승', GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('중');
    expect(liveDummyTierFor('최연승', GAME_IDS.QUATRO)).toBe('중');
    expect(liveDummyTierFor('최연승', GAME_IDS.BAN_PICK)).toBe('중');
  });
});

describe('자정 넘는 창', () => {
  it('start > end 이면 밤과 다음날 새벽이 켜진다', () => {
    expect(isMinsInLiveWindow(23 * 60 + 29, 23 * 60 + 30, 60)).toBe(false);
    expect(isMinsInLiveWindow(23 * 60 + 30, 23 * 60 + 30, 60)).toBe(true);
    expect(isMinsInLiveWindow(0, 23 * 60 + 30, 60)).toBe(true);
    expect(isMinsInLiveWindow(59, 23 * 60 + 30, 60)).toBe(true);
    expect(isMinsInLiveWindow(60, 23 * 60 + 30, 60)).toBe(false);
  });
});

describe('Jack 활동 창', () => {
  it('평일 23:30 KST는 켜짐, 23:29·01:00은 꺼짐', () => {
    expect(isJackLiveWindow(new Date('2026-08-24T14:29:00.000Z'))).toBe(false);
    expect(isJackLiveWindow(new Date('2026-08-24T14:30:00.000Z'))).toBe(true);
    expect(isJackLiveWindow(new Date('2026-08-24T15:59:00.000Z'))).toBe(true);
    expect(isJackLiveWindow(new Date('2026-08-24T16:00:00.000Z'))).toBe(false);
  });

  it('사목만 중, 나머지는 상', () => {
    expect(liveDummyTierFor('Jack', GAME_IDS.FOUR_GRAVITY)).toBe('중');
    expect(liveDummyTierFor('Jack', GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('상');
    expect(liveDummyTierFor('Jack', GAME_IDS.QUATRO)).toBe('상');
    expect(liveDummyTierFor('Jack', GAME_IDS.BAN_PICK)).toBe('상');
  });
});

describe('아이언현성 활동 창', () => {
  it('off — 예전 창 시각에도 꺼짐', () => {
    expect(isIronhyunseongLiveWindow(new Date('2026-08-24T13:30:00.000Z'))).toBe(false);
    expect(isIronhyunseongLiveWindow(new Date('2026-08-24T15:00:00.000Z'))).toBe(false);
  });

  it('사목만 하, 나머지는 중', () => {
    expect(liveDummyTierFor('아이언현성', GAME_IDS.FOUR_GRAVITY)).toBe('하');
    expect(liveDummyTierFor('아이언현성', GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('중');
    expect(liveDummyTierFor('아이언현성', GAME_IDS.QUATRO)).toBe('중');
    expect(liveDummyTierFor('아이언현성', GAME_IDS.BAN_PICK)).toBe('중');
  });
});
