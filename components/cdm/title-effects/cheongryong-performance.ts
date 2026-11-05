import { DRAGON_CYCLE_MS, DRAGON_VIEW } from './cheongryong-path';

export const DRAGON_FPS = 30;
export const DRAGON_FALLBACK_FPS = 20;
export function dragonSurfaceSize(pixelWidth: number) {
  const width = pixelWidth <= DRAGON_VIEW.width / 2 ? DRAGON_VIEW.width / 2 : DRAGON_VIEW.width;
  return { width, height: width * DRAGON_VIEW.height / DRAGON_VIEW.width };
}
export function dragonPixelRatio(ratio: number) { return Math.max(1, Math.min(Number.isFinite(ratio) ? ratio : 1, 2)); }
export function dragonFrameIndex(elapsed: number) { return Math.floor((Math.max(0, elapsed) % DRAGON_CYCLE_MS) / (1000 / DRAGON_FPS)); }
export function createDragonClock() {
  let origin: number | undefined;
  let heldAt: number | undefined;
  let shift = 0;
  return {
    elapsed(now: number) { origin ??= now; return (heldAt ?? now) - origin - shift; },
    pause(now: number) { origin ??= now; heldAt ??= now; },
    resume(now: number) { if (heldAt !== undefined) { shift += now - heldAt; heldAt = undefined; } },
    get paused() { return heldAt !== undefined; },
  };
}
