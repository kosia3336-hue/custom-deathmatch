import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LIVE_DUMMY_ROSTER, isLiveDummyWindowOpen } from '../dummy/live/roster.js';
import type { LiveDummyRuntime } from '../dummy/live/roster.js';
import { listLiveDummyOnlineUsers } from '../dummy/live/online.js';
import { registerLiveDummy, resetLiveDummyStateForTests } from '../dummy/live/state.js';
import { mergeOnlineUsers } from '../socket/lobby.js';
import type { OnlineUser } from '@shared/types/events.js';

function nicknames(now: Date): string[] {
  return listLiveDummyOnlineUsers(now)
    .map((u) => u.nickname)
    .sort();
}

function rosterOpenNicknames(now: Date): string[] {
  return LIVE_DUMMY_ROSTER.filter((d) => isLiveDummyWindowOpen(d.window, now))
    .map((d) => d.nickname)
    .sort();
}

describe('운영 더미 로비 접속 합성', () => {
  const prev = process.env.DUMMY_LIVE;

  beforeEach(() => {
    resetLiveDummyStateForTests();
    process.env.DUMMY_LIVE = '1';
    for (const dummy of LIVE_DUMMY_ROSTER) {
      registerLiveDummy(`mem-${dummy.key}`, dummy);
    }
  });

  afterEach(() => {
    resetLiveDummyStateForTests();
    if (prev === undefined) delete process.env.DUMMY_LIVE;
    else process.env.DUMMY_LIVE = prev;
  });

  it('DUMMY_LIVE 없으면 비어 있다', () => {
    delete process.env.DUMMY_LIVE;
    expect(listLiveDummyOnlineUsers(new Date('2026-08-23T13:10:00.000Z'))).toEqual([]);
  });

  it('등록된 로스터 중 창이 열린 사람만 — 닉을 테스트에 박지 않는다', () => {
    const samples = [
      new Date('2026-08-23T11:00:00.000Z'),
      new Date('2026-08-23T12:10:00.000Z'),
      new Date('2026-08-23T13:10:00.000Z'),
      new Date('2026-08-23T13:40:00.000Z'),
      new Date('2026-08-23T14:40:00.000Z'),
      new Date('2026-08-23T15:10:00.000Z'),
      new Date('2026-08-23T15:40:00.000Z'),
    ];
    for (const now of samples) {
      expect(nicknames(now)).toEqual(rosterOpenNicknames(now));
    }
  });

  it('로스터에 없는 더미도 등록되고 창이 열려 있으면 붙는다', () => {
    const extra: LiveDummyRuntime = {
      key: 'extra',
      nickname: '추가더미',
      email: 'dummy_extra@dummy.internal',
      socketId: 'live-dummy:extra',
      passwordSeed: 'dummy:extra',
      defaultTier: '중',
      window: { kind: 'daily', startMin: 0, endMin: 24 * 60 },
    };
    registerLiveDummy('mem-extra', extra);
    const atNightOffHours = new Date('2026-08-24T11:00:00.000Z');
    expect(rosterOpenNicknames(atNightOffHours)).not.toContain('추가더미');
    expect(nicknames(atNightOffHours)).toContain('추가더미');
  });

  it('소켓 명단과 memberId가 겹치면 한 번만', () => {
    const first = LIVE_DUMMY_ROSTER[0];
    if (!first) throw new Error('로스터가 비어 있다');
    const now = new Date('2026-08-24T13:10:00.000Z');
    const fromSockets: OnlineUser[] = [
      { memberId: `mem-${first.key}`, nickname: first.nickname, status: 'lobby' },
    ];
    const merged = mergeOnlineUsers(fromSockets, listLiveDummyOnlineUsers(now));
    expect(merged.filter((u) => u.memberId === `mem-${first.key}`)).toHaveLength(1);
    expect(merged.map((u) => u.nickname).sort()).toEqual(rosterOpenNicknames(now));
  });
});
