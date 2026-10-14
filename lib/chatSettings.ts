import type { ChatMessage } from '@/shared/types';

const STORAGE_KEY = 'cdm-spectator-notifications';
const listeners = new Set<() => void>();
let cached: boolean | null = null;
let cachedWindow: unknown = null;

/** 기본값은 켜짐. 저장소를 사용할 수 없어도 현재 탭에서는 설정을 유지한다. */
export function getSpectatorNotifications(): boolean {
  if (typeof window === 'undefined') return true;
  if (cached === null || cachedWindow !== window) {
    cachedWindow = window;
    try {
      cached = window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      cached = true;
    }
  }
  return cached;
}

export function setSpectatorNotifications(enabled: boolean): void {
  cached = enabled;
  if (typeof window !== 'undefined') {
    cachedWindow = window;
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // 저장소 접근이 막혀도 메모리의 설정을 사용한다.
    }
  }
  listeners.forEach((notify) => notify());
}

export function subscribeChatSettings(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    cached = null;
    notify();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/**
 * 안 읽은 채팅 배지에 셀 메시지인지. '관전자 입·퇴장 알림' 을 끄면 관전자 입·퇴장만 배지에서 빠진다.
 * 채팅창에는 설정과 상관없이 항상 보인다 — 이 설정은 배지(알림)만 켜고 끈다.
 */
export function countsTowardChatBadge(
  message: ChatMessage,
  spectatorNotifications: boolean,
): boolean {
  return (
    spectatorNotifications ||
    !message.isSystem ||
    (message.systemEvent !== 'spectator_join' && message.systemEvent !== 'spectator_leave')
  );
}
