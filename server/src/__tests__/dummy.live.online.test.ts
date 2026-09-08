import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LIVE_DUMMY_ROSTER, isLiveDummyWindowOpen } from '../dummy/live/roster.js';
import { listLiveDummyOnlineUsers } from '../dummy/live/online.js';
import { registerLiveDummy, resetLiveDummyStateForTests } from '../dummy/live/state.js';
import { rankQueueStore, type RankQueueEntry } from '../store/rankQueue.js';
import { roomStore } from '../store/rooms.js';
import { mergeOnlineUsers } from '../socket/lobby.js';
import type { OnlineUser } from '@shared/types/events.js';

function nicknames(): string[] {
  return listLiveDummyOnlineUsers()
    .map((u) => u.nickname)
    .sort();
}

function queueEntry(memberId: string, nickname: string): RankQueueEntry {
  return {
    socketId: `sock-${memberId}`,
    memberId,
    nickname,
    displayedTitle: null,
    tier: 'gold',
    rp: 50,
    placementDone: true,
    winStreak: 0,
    lossStreak: 0,
    joinedAt: Date.now(),
    seasonId: 1,
  };
}

describe('운영 더미 로비 접속 합성', () => {
  const prevLive = process.env.DUMMY_LIVE;
  const prevRank = process.env.DUMMY_LIVE_RANK;

  beforeEach(() => {
    resetLiveDummyStateForTests();
    process.env.DUMMY_LIVE = '1';
    delete process.env.DUMMY_LIVE_RANK;
    for (const dummy of LIVE_DUMMY_ROSTER) {
      registerLiveDummy(`mem-${dummy.key}`, dummy);
      rankQueueStore.removeByMemberId(`mem-${dummy.key}`);
      rankQueueStore.releaseMatch(`mem-${dummy.key}`);
    }
  });

  afterEach(() => {
    resetLiveDummyStateForTests();
    for (const dummy of LIVE_DUMMY_ROSTER) {
      rankQueueStore.removeByMemberId(`mem-${dummy.key}`);
      rankQueueStore.releaseMatch(`mem-${dummy.key}`);
    }
    if (prevLive === undefined) delete process.env.DUMMY_LIVE;
    else process.env.DUMMY_LIVE = prevLive;
    if (prevRank === undefined) delete process.env.DUMMY_LIVE_RANK;
    else process.env.DUMMY_LIVE_RANK = prevRank;
  });

  it('DUMMY_LIVE 없으면 비어 있다', () => {
    delete process.env.DUMMY_LIVE;
    expect(listLiveDummyOnlineUsers()).toEqual([]);
  });

  it('창이 열려도 랭크를 안 돌리면 접속 인원에 안 넣는다', () => {
    const now = new Date('2026-08-24T12:10:00.000Z');
    expect(LIVE_DUMMY_ROSTER.some((d) => isLiveDummyWindowOpen(d.window, now))).toBe(true);
    expect(listLiveDummyOnlineUsers(now)).toEqual([]);
  });

  it('랭크 큐에 앉은 더미만 접속 인원에 넣는다', () => {
    process.env.DUMMY_LIVE_RANK = '1';
    const dummy = LIVE_DUMMY_ROSTER[1]!;
    expect(rankQueueStore.enqueue(queueEntry(`mem-${dummy.key}`, dummy.nickname)).matched).toBe(
      false,
    );
    expect(nicknames()).toEqual([dummy.nickname]);
  });

  it('랭크 방에 있으면 큐에 없어도 넣는다', () => {
    const dummy = LIVE_DUMMY_ROSTER[0]!;
    const room = roomStore.create({
      title: '[랭크] test',
      gameId: 'ban-pick',
      gameName: '밴픽',
      playMode: 'multi',
      roomType: 'rank',
      maxPlayers: 2,
      minPlayers: 2,
      host: {
        id: 'tok-dummy-rank',
        nickname: dummy.nickname,
        isHost: true,
        isReady: true,
        joinedAt: Date.now(),
        memberId: `mem-${dummy.key}`,
      },
      isRanked: true,
    });
    expect(nicknames()).toEqual([dummy.nickname]);
    roomStore.delete(room.id);
    expect(nicknames()).toEqual([]);
  });

  it('소켓 명단과 memberId가 겹치면 한 번만', () => {
    process.env.DUMMY_LIVE_RANK = '1';
    const dummy = LIVE_DUMMY_ROSTER[1]!;
    rankQueueStore.enqueue(queueEntry(`mem-${dummy.key}`, dummy.nickname));
    const fromSockets: OnlineUser[] = [
      { memberId: `mem-${dummy.key}`, nickname: dummy.nickname, status: 'lobby' },
    ];
    const merged = mergeOnlineUsers(fromSockets, listLiveDummyOnlineUsers());
    expect(merged.filter((u) => u.memberId === `mem-${dummy.key}`)).toHaveLength(1);
    expect(merged.map((u) => u.nickname)).toEqual([dummy.nickname]);
  });
});
