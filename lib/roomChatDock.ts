/**
 * 대기실 채팅 판을 어디에 둘지 — 오른쪽 · 아래 · 접기. 기기(브라우저)마다 기억한다.
 * useSyncExternalStore 로 읽는다(서버 렌더는 기본값 'right').
 */

export type RoomChatDock = 'right' | 'bottom' | 'collapsed';

const KEY = 'room-chat-dock';
const listeners = new Set<() => void>();
let cached: RoomChatDock | null = null;

function isDock(value: unknown): value is RoomChatDock {
  return value === 'right' || value === 'bottom' || value === 'collapsed';
}

export function getRoomChatDock(): RoomChatDock {
  if (cached) return cached;
  try {
    const stored = window.localStorage.getItem(KEY);
    cached = isDock(stored) ? stored : 'right';
  } catch {
    cached = 'right';
  }
  return cached;
}

export function getServerRoomChatDock(): RoomChatDock {
  return 'right';
}

export function setRoomChatDock(next: RoomChatDock): void {
  cached = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // 저장 불가 환경이면 이번 방문 동안만 기억
  }
  listeners.forEach((listener) => listener());
}

export function subscribeRoomChatDock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
