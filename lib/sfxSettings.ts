/**
 * 효과음(SFX) 전역 on/off 설정.
 *
 * BGM(`bgm-muted`)과 별개의 localStorage 키를 사용한다.
 * 모든 효과음 유틸(lib/sfx.ts, lib/eventSfx.ts, lib/indianPokerSfx.ts,
 * lib/smsEventSfx.ts, CaptureEffect)이 재생 직전에 isSfxMuted()를 확인한다.
 */

const LS_SFX_MUTED = 'sfx-muted';

/** 설정 UI 리렌더용 구독 (useSyncExternalStore) */
const listeners = new Set<() => void>();

export function subscribeSfxMuted(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LS_SFX_MUTED) === '1';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_SFX_MUTED, muted ? '1' : '0');
  } catch {}
  listeners.forEach((cb) => cb());
}
