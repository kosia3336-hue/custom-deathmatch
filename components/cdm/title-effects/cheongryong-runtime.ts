import { createDragonGpu } from './cheongryong-gpu';
import { drawDragonCanvas } from './cheongryong-canvas';
import { DRAGON_CYCLE_MS, DRAGON_VIEW } from './cheongryong-path';
import { createDragonClock, dragonFrameIndex, dragonSurfaceSize, DRAGON_FALLBACK_FPS, DRAGON_FPS } from './cheongryong-performance';

type Client = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; visible: boolean };
const clients = new Set<Client>();
const clock = createDragonClock();
let image: HTMLImageElement | undefined;
let gpu: ReturnType<typeof createDragonGpu> | undefined;
let gpuAttempted = false;
let fallback: HTMLCanvasElement | undefined;
let fallbackIndex = -1;
let motion: MediaQueryList | undefined;
let raf = 0;
let lastPaint = -Infinity;
let lastIndex = -1;
let backend = 'webgl';
let failedImage = false;
let compatibilityMode = false;

function drawable() { return [...clients].filter(c => c.visible && c.canvas.width > 0 && c.canvas.height > 0); }
function getImage() {
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', refresh);
    image.addEventListener('error', onImageError);
    image.src = '/effects/titles/cheongryong/dragon-travel.webp';
  }
  return image;
}

function paint(now: number, force: boolean) {
  const visible = drawable();
  if (!visible.length || document.hidden) return;
  const source = getImage();
  if (!source.complete || !source.naturalWidth) return;
  const index = motion?.matches ? 0 : dragonFrameIndex(clock.elapsed(now));
  if (!force && index === lastIndex) return;
  lastIndex = index;
  const size = dragonSurfaceSize(Math.max(...visible.map(c => c.canvas.width)));
  const phase = index / (DRAGON_CYCLE_MS / 1000 * DRAGON_FPS);
  const allowGpu = !compatibilityMode && !motion?.matches;
  if (allowGpu && !gpuAttempted) {
    gpuAttempted = true;
    try { gpu = createDragonGpu(source); } catch { gpu = null; }
  }
  let surface: HTMLCanvasElement | undefined;
  if (allowGpu && gpu?.draw(phase, size.width, size.height)) {
    surface = gpu.canvas;
    backend = 'webgl';
    if (fallback) { fallback.width = fallback.height = 1; fallback = undefined; fallbackIndex = -1; }
  } else {
    backend = 'canvas2d';
    fallback ??= document.createElement('canvas');
    // 2D 삼각형의 고품질 축소는 되레 느리므로 논리 해상도에서 한 번 그린다.
    if (fallback.width !== DRAGON_VIEW.width || fallback.height !== DRAGON_VIEW.height) { fallback.width = DRAGON_VIEW.width; fallback.height = DRAGON_VIEW.height; fallbackIndex = -1; }
    if (fallbackIndex !== index) {
      // 복잡한 2D 클립의 누적 명령을 버린다. GPU 경로에서는 이러한 리셋/재할당이 없다.
      fallback.width = DRAGON_VIEW.width;
      fallback.height = DRAGON_VIEW.height;
      const context = fallback.getContext('2d');
      if (!context) return;
      drawDragonCanvas(context, source, phase);
      fallbackIndex = index;
    }
    surface = fallback;
  }
  // 같은 위상의 한 장을 모든 가시 칭호에 복사한다. 인스턴스마다 메시를 다시 만들지 않는다.
  for (const client of visible) {
    const { canvas, context } = client;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(surface, 0, 0, canvas.width, canvas.height);
    canvas.dataset.dragonFrame = String(index);
    canvas.dataset.dragonBackend = backend;
    canvas.dataset.dragonSurface = `${surface.width}x${surface.height}`;
  }
}
function shouldRun() { return clients.size > 0 && !failedImage && !document.hidden && !motion?.matches && !clock.paused && [...clients].some(c => c.visible); }
function schedule() { if (!raf && shouldRun()) raf = requestAnimationFrame(tick); }
function tick(now: number) {
  raf = 0;
  if (!shouldRun()) return;
  if (now - lastPaint >= 1000 / (backend === 'canvas2d' ? DRAGON_FALLBACK_FPS : DRAGON_FPS) - 0.5) {
    paint(now, false);
    lastPaint = now;
  }
  schedule();
}
function refresh() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  for (const client of clients) {
    const badge = client.canvas.closest<HTMLElement>('.title-cheongryong');
    const state = client.visible && !document.hidden && !motion?.matches ? 'running' : 'paused';
    if (badge && badge.style.getPropertyValue('--cdm-cheongryong-weather-state') !== state) badge.style.setProperty('--cdm-cheongryong-weather-state', state);
  }
  paint(performance.now(), true);
  schedule();
}
function onImageError() { failedImage = true; if (raf) cancelAnimationFrame(raf); raf = 0; }

/** 개발 성능 화면의 호환 모드 검증용. 일반 서비스에서는 auto(WebGL → 2D 폴백)만 사용한다. */
export function setCheongryongCompatibilityMode(value: boolean) {
  compatibilityMode = value;
  lastIndex = -1;
  if (clients.size) refresh();
}

/** 로컬 시안 재생 제어도 공유 시계를 멈춘다. 구름은 별도 CSS 동작이라 계속 흐른다. */
export function setCheongryongMotionPaused(paused: boolean) {
  if (paused) clock.pause(performance.now()); else clock.resume(performance.now());
  if (clients.size) refresh();
}

export function subscribeDragon(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return { visible(_value: boolean) {}, resize() {}, dispose() {} };
  const client: Client = { canvas, context, visible: false };
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'low';
  if (!clients.size) {
    motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
  }
  clients.add(client);
  return {
    visible(value: boolean) { if (value !== client.visible) { client.visible = value; refresh(); } },
    resize() { if (client.visible) refresh(); },
    dispose() {
      clients.delete(client);
      canvas.closest<HTMLElement>('.title-cheongryong')?.style.removeProperty('--cdm-cheongryong-weather-state');
      if (clients.size) { refresh(); return; }
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('visibilitychange', refresh);
      motion?.removeEventListener('change', refresh);
      motion = undefined;
      image?.removeEventListener('load', refresh);
      image?.removeEventListener('error', onImageError);
      image = undefined;
      failedImage = false;
      gpu?.dispose(); gpu = undefined; gpuAttempted = false;
      if (fallback) fallback.width = fallback.height = 1;
      fallback = undefined;
      fallbackIndex = -1;
      lastPaint = -Infinity; lastIndex = -1; backend = 'webgl';
    },
  };
}
