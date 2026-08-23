import type { OnlineUser } from '@shared/types/events.js';
import { roomStore } from '../../store/rooms.js';
import { isLiveDummyWindowOpen } from './roster.js';
import { listRegisteredLiveDummies } from './state.js';
import { isLiveDummyEnabled } from './window.js';

function statusForMember(memberId: string): OnlineUser['status'] {
  const room = roomStore.findByMemberId(memberId);
  if (!room) return 'lobby';
  return room.status === 'playing' ? 'playing' : 'waiting';
}

/**
 * 활동 창이 열린 **등록된** 운영 더미.
 * 닉/인원을 여기 적지 않는다. 로스터에 넣고 startLiveDummy가 register하면 자동으로 붙는다.
 */
export function listLiveDummyOnlineUsers(now = new Date()): OnlineUser[] {
  if (!isLiveDummyEnabled()) return [];

  const users: OnlineUser[] = [];
  for (const { memberId, dummy } of listRegisteredLiveDummies()) {
    if (!isLiveDummyWindowOpen(dummy.window, now)) continue;
    users.push({
      memberId,
      nickname: dummy.nickname,
      status: statusForMember(memberId),
    });
  }
  return users;
}

export function liveDummyOnlineSignature(now = new Date()): string {
  return listLiveDummyOnlineUsers(now)
    .map((u) => `${u.memberId}:${u.status}`)
    .sort()
    .join(',');
}
