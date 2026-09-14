/**
 * 대기실 채팅창을 붙인 가장자리 — 상·하·좌·우. 기기(브라우저)마다 기억한다.
 * 넓은 화면 전용이다(좁은 화면은 헤더 채팅 버튼 → 시트). useSyncExternalStore 로 읽는다.
 */

export type RoomChatDock = 'left' | 'right' | 'top' | 'bottom';

const KEY = 'room-chat-dock';
const listeners = new Set<() => void>();
let cached: RoomChatDock | null = null;

function isDock(value: unknown): value is RoomChatDock {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
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

/**
 * 끌어서 놓은 지점에서 가장 가까운 가장자리.
 * 화면이 가로로 길어 거리를 그대로 비교하면 위·아래에 잘 안 붙으므로, 가로·세로 길이에 대한 비율로 비교한다
 * (화면을 대각선으로 네 칸 나눈 것과 같다). 같으면 왼쪽·오른쪽·위·아래 순.
 */
export function nearestDockEdge(x: number, y: number, width: number, height: number): RoomChatDock {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const candidates: [RoomChatDock, number][] = [
    ['left', x / w],
    ['right', (w - x) / w],
    ['top', y / h],
    ['bottom', (h - y) / h],
  ];
  return candidates.reduce((best, next) => (next[1] < best[1] ? next : best))[0];
}
