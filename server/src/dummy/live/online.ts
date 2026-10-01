import type { OnlineUser } from '@shared/types/events.js';
import { roomStore } from '../../store/rooms.js';
import { rankQueueStore } from '../../store/rankQueue.js';
import { listRegisteredLiveDummies } from './state.js';
import { isLiveDummyEnabled } from './window.js';

function statusForMember(memberId: string): OnlineUser['status'] {
  const room = roomStore.findByMemberId(memberId);
  if (!room) return 'lobby';
  return room.status === 'playing' ? 'playing' : 'waiting';
}

/** 랭크 큐·매칭 확정·랭크 방. 창만 열렸다고 넣지 않는다. */
function isLiveDummyInRank(memberId: string): boolean {
  if (rankQueueStore.has(memberId) || rankQueueStore.isPendingMatch(memberId)) return true;
  return roomStore.findByMemberId(memberId)?.isRanked === true;
}

/**
 * 랭크를 돌리고 있는 **등록된** 운영 더미.
 * 닉/인원을 여기 적지 않는다. 로스터에 넣고 startLiveDummy가 register하면 자동으로 붙는다.
 */
export function listLiveDummyOnlineUsers(_now = new Date()): OnlineUser[] {
  if (!isLiveDummyEnabled()) return [];

  const users: OnlineUser[] = [];
  for (const { memberId, dummy } of listRegisteredLiveDummies()) {
    if (!isLiveDummyInRank(memberId)) continue;
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
