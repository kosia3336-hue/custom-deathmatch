/**
 * 효과음(SFX) 전역 on/off 설정.
 *
 * BGM(`bgm-muted`)과 별개의 localStorage 키를 사용한다.
 * 모든 효과음 유틸(lib/sfx.ts, lib/eventSfx.ts, lib/indianPokerSfx.ts,
 * lib/smsEventSfx.ts, CaptureEffect)이 재생 직전에 isSfxMuted()를 확인한다.
 */

const LS_SFX_MUTED = 'sfx-muted';
const LS_SFX_VOLUME = 'sfx-volume';
const outputs = new Map<AudioContext, GainNode>();

export function getSfxVolume(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = window.localStorage.getItem(LS_SFX_VOLUME);
    const value = raw == null ? 1 : Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  } catch {
    return 1;
  }
}

/** 모든 합성 효과음이 공유하는 컨텍스트별 최종 볼륨 노드. */
export function getSfxOutput(ctx: AudioContext): GainNode {
  let output = outputs.get(ctx);
  if (!output) {
    output = ctx.createGain();
    output.connect(ctx.destination);
    outputs.set(ctx, output);
  }
  output.gain.value = isSfxMuted() ? 0 : getSfxVolume();
  return output;
}

function notify() {
  for (const [ctx, output] of outputs) {
    if (ctx.state === 'closed') outputs.delete(ctx);
    else output.gain.value = isSfxMuted() ? 0 : getSfxVolume();
  }
  listeners.forEach((cb) => cb());
}

export function setSfxVolume(value: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(value)) return;
  try {
    window.localStorage.setItem(LS_SFX_VOLUME, String(Math.max(0, Math.min(1, value))));
  } catch {}
  notify();
}

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
  notify();
}
