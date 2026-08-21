import { describe, it, expect } from 'vitest';
import { onlineUsersPayload } from '../socket/lobby.js';
import type { OnlineUser } from '@shared/types/events.js';

const users: OnlineUser[] = [
  { memberId: 'a', nickname: '갑', status: 'waiting' },
  { memberId: 'b', nickname: '을', status: 'lobby' },
];

describe('onlineUsersPayload', () => {
  it('천하는 명단과 count', () => {
    expect(onlineUsersPayload('천하', users)).toEqual({ users, count: 2 });
  });

  it('나머지는 빈 명단 + count', () => {
    expect(onlineUsersPayload('타이탄', users)).toEqual({ users: [], count: 2 });
    expect(onlineUsersPayload(undefined, users)).toEqual({ users: [], count: 2 });
  });
});
