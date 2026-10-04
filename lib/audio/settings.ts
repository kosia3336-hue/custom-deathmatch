/**
 * 효과음(SFX) 전역 음소거·음량 설정.
 *
 * BGM(`bgm-muted`/`bgm-volume`, BgmProvider)과 별개의 localStorage 키를 사용한다.
 * 모든 효과음 유틸(lib/audio/player.ts, lib/audio/synth/*, lib/audio/skins/*,
 * lib/audio/synth/capture.ts)이 재생 직전에 isSfxMuted()/getSfxOutput()을 거친다.
 *
 * 값은 처음 읽을 때 한 번만 localStorage 에서 불러와 메모리에 둔다. 효과음은 한 판에
 * 수백 번 울리고 설정 화면은 렌더마다 스냅샷을 읽으므로, 매번 스토리지를 뒤지지 않는다.
 * 다른 탭에서 바꾼 값은 storage 이벤트로 받아 캐시를 비운다.
 */

const LS_SFX_MUTED = 'sfx-muted';
const LS_SFX_VOLUME = 'sfx-volume';

/** 음소거를 풀 때 이보다 작으면 들리지 않으므로 기본 음량으로 되돌린다. */
const MIN_AUDIBLE_VOLUME = 0.05;
const DEFAULT_VOLUME = 1;

interface SfxState {
  muted: boolean;
  volume: number;
}

const outputs = new Map<AudioContext, GainNode>();
const listeners = new Set<() => void>();

let cache: SfxState | null = null;
/** 캐시를 채운 window — 테스트처럼 window 가 바뀌면 다시 읽는다. */
let cacheWindow: unknown = null;
let storageListening = false;

const clampVolume = (v: number) => Math.max(0, Math.min(1, v));

function load(): SfxState {
  try {
    const ls = window.localStorage;
    const raw = ls.getItem(LS_SFX_VOLUME);
    const volume = raw == null ? DEFAULT_VOLUME : Number(raw);
    return {
      muted: ls.getItem(LS_SFX_MUTED) === '1',
      volume: Number.isFinite(volume) ? clampVolume(volume) : DEFAULT_VOLUME,
    };
  } catch {
    return { muted: false, volume: DEFAULT_VOLUME };
  }
}

function read(): SfxState {
  if (typeof window === 'undefined') return { muted: false, volume: DEFAULT_VOLUME };
  if (!cache || cacheWindow !== window) {
    cache = load();
    cacheWindow = window;
  }
  return cache;
}

function notify() {
  const gain = effectiveGain();
  for (const [ctx, output] of outputs) {
    if (ctx.state === 'closed') outputs.delete(ctx);
    else output.gain.value = gain;
  }
  listeners.forEach((cb) => cb());
}

function update(patch: Partial<SfxState>) {
  if (typeof window === 'undefined') return;
  const prev = read();
  const next = { ...prev, ...patch };
  if (next.muted === prev.muted && next.volume === prev.volume) return;
  cache = next;
  try {
    if (next.muted !== prev.muted) window.localStorage.setItem(LS_SFX_MUTED, next.muted ? '1' : '0');
    if (next.volume !== prev.volume) window.localStorage.setItem(LS_SFX_VOLUME, String(next.volume));
  } catch {}
  notify();
}

function effectiveGain(): number {
  const s = read();
  return s.muted ? 0 : s.volume;
}

export function getSfxVolume(): number {
  return read().volume;
}

export function isSfxMuted(): boolean {
  return read().muted;
}

/** 모든 합성 효과음이 공유하는 컨텍스트별 최종 볼륨 노드. */
export function getSfxOutput(ctx: AudioContext): GainNode {
  let output = outputs.get(ctx);
  if (!output) {
    output = ctx.createGain();
    output.connect(ctx.destination);
    outputs.set(ctx, output);
  }
  output.gain.value = effectiveGain();
  return output;
}

export function setSfxVolume(value: number): void {
  if (!Number.isFinite(value)) return;
  update({ volume: clampVolume(value) });
}

/** 음소거를 풀 때 음량이 사실상 0 이면 기본 음량으로 되돌린다 — '켰는데 안 들림' 방지. */
export function setSfxMuted(muted: boolean): void {
  if (!muted && read().volume < MIN_AUDIBLE_VOLUME) {
    update({ muted, volume: DEFAULT_VOLUME });
    return;
  }
  update({ muted });
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== LS_SFX_MUTED && e.key !== LS_SFX_VOLUME) return;
  cache = null;
  notify();
}

/** 설정 UI 리렌더용 구독 (useSyncExternalStore). 음소거·음량 어느 쪽이 바뀌어도 부른다. */
export function subscribeSfxSettings(cb: () => void): () => void {
  listeners.add(cb);
  if (!storageListening && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', onStorage);
    storageListening = true;
  }
  return () => {
    listeners.delete(cb);
  };
}
