import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';

// token → Map<skinId, timer>
const expiryTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

/**
 * 만료 시각이 있는 착용 스킨에 대해 타이머를 등록한다.
 * 타이머가 만료되면 게임 중이 아닌 경우에만 세션에서 해당 스킨을 제거한다.
 * 기존 토큰의 타이머는 전부 취소 후 재등록한다.
 */
export function scheduleSkinExpiries(
  token: string,
  expiries: Array<{ skinId: string; expiresAt: Date }>,
): void {
  cancelSkinExpiries(token);
  if (expiries.length === 0) return;

  const now = Date.now();
  for (const { skinId, expiresAt } of expiries) {
    const delay = expiresAt.getTime() - now;
    if (delay <= 0) continue;

    let timerMap = expiryTimers.get(token);
    if (!timerMap) {
      timerMap = new Map();
      expiryTimers.set(token, timerMap);
    }

    const timer = setTimeout(() => {
      const socketId = sessions.getSocketByToken(token);
      const roomId = socketId ? sessions.getRoom(socketId) : undefined;
      const room = roomId ? roomStore.get(roomId) : undefined;

      // 게임 진행 중이면 유지 — 게임 종료 후 다음 세션 갱신 시 자연스럽게 제거됨
      if (room?.status === 'playing') return;

      const current = sessions.getEquippedSkins(token);
      const updated = current.filter((s) => s.skinId !== skinId);
      sessions.setMemberInfo(
        token,
        sessions.getMemberId(token),
        sessions.getDisplayedTitle(token),
        updated,
        sessions.getGuildMark(token),
        sessions.getGuildId(token),
      );

      expiryTimers.get(token)?.delete(skinId);
    }, delay);

    timerMap.set(skinId, timer);
  }
}

/** 토큰에 등록된 만료 타이머를 모두 취소한다. */
export function cancelSkinExpiries(token: string): void {
  const timerMap = expiryTimers.get(token);
  if (!timerMap) return;
  for (const timer of timerMap.values()) clearTimeout(timer);
  expiryTimers.delete(token);
}
