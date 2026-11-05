import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ gpu: { canvas: {} as HTMLCanvasElement, draw: vi.fn(() => true), dispose: vi.fn() }, create: vi.fn(), fallback: vi.fn() }));
vi.mock('../../../components/cdm/title-effects/cheongryong-gpu', () => ({ createDragonGpu: mocks.create }));
vi.mock('../../../components/cdm/title-effects/cheongryong-canvas', () => ({ drawDragonCanvas: mocks.fallback }));

class Surface {
  width = 270; height = 142;
  dataset: Record<string, string> = {};
  properties = new Map<string, string>();
  badge = { style: { getPropertyValue: (name: string) => this.properties.get(name) || '', setProperty: (name: string, value: string) => this.properties.set(name, value), removeProperty: (name: string) => this.properties.delete(name) } };
  context = { clearRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'low' };
  getContext() { return this.context; }
  closest() { return this.badge; }
}
class Source extends EventTarget {
  complete = true; naturalWidth = 1280; src = ''; decoding = '';
  constructor() { super(); sources.push(this); }
}
let sources: Source[] = [];
let now = 1000;
let pending: Map<number, FrameRequestCallback>;
let documentState: EventTarget & { hidden: boolean; createElement: () => Surface };
let preference: EventTarget & { matches: boolean };
let disposeAll: (() => void)[];
const attach = async () => {
  const runtime = await import('../../../components/cdm/title-effects/cheongryong-runtime');
  const canvas = new Surface();
  const subscription = runtime.subscribeDragon(canvas as unknown as HTMLCanvasElement);
  disposeAll.push(subscription.dispose);
  return { ...runtime, canvas, subscription };
};
function frame(time: number) { now = time; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(time)); }

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.create.mockReturnValue(mocks.gpu); mocks.gpu.draw.mockReturnValue(true);
  sources = []; now = 1000; pending = new Map(); disposeAll = [];
  documentState = Object.assign(new EventTarget(), { hidden: false, createElement: () => new Surface() });
  preference = Object.assign(new EventTarget(), { matches: false });
  let id = 0;
  vi.stubGlobal('document', documentState);
  vi.stubGlobal('window', { matchMedia: () => preference });
  vi.stubGlobal('Image', Source);
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => pending.delete(key));
});
afterEach(() => { disposeAll.forEach(dispose => dispose()); vi.unstubAllGlobals(); });

describe('청룡 공유 런타임', () => {
  it('20개 칭호가 하나의 이미지/GPU/rAF를 공유하며 프레임당 한 번만 변형한다', async () => {
    const all = await Promise.all(Array.from({ length: 20 }, attach));
    all.forEach(c => c.subscription.visible(true));
    expect(sources).toHaveLength(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);
    mocks.gpu.draw.mockClear();
    all.forEach(c => c.canvas.context.drawImage.mockClear());
    frame(1100);
    expect(mocks.gpu.draw).toHaveBeenCalledTimes(1);
    all.forEach(c => expect(c.canvas.context.drawImage).toHaveBeenCalledTimes(1));
    expect(pending.size).toBe(1);
  });
  it('화면 밖/숨긴 탭에서는 Canvas와 구름 모두 정지한다', async () => {
    const c = await attach();
    expect(sources).toHaveLength(0);
    c.subscription.visible(true);
    c.subscription.visible(false);
    expect(pending.size).toBe(0);
    expect(c.canvas.properties.get('--cdm-cheongryong-weather-state')).toBe('paused');
    c.subscription.visible(true);
    documentState.hidden = true;
    documentState.dispatchEvent(new Event('visibilitychange'));
    expect(pending.size).toBe(0);
    expect(c.canvas.properties.get('--cdm-cheongryong-weather-state')).toBe('paused');
    documentState.hidden = false;
    documentState.dispatchEvent(new Event('visibilitychange'));
    expect(pending.size).toBe(1);
  });
  it('용 정지 시 rAF가 남지 않으며 구름은 독립적으로 계속 흐른다', async () => {
    const c = await attach(); c.subscription.visible(true); frame(1200);
    c.setCheongryongMotionPaused(true);
    const held = c.canvas.dataset.dragonFrame;
    expect(pending.size).toBe(0);
    expect(c.canvas.properties.get('--cdm-cheongryong-weather-state')).toBe('running');
    now = 20_000; c.subscription.resize();
    expect(c.canvas.dataset.dragonFrame).toBe(held);
    c.setCheongryongMotionPaused(false);
    expect(pending.size).toBe(1);
  });
  it('모션 감소에서는 정지 프레임만 그린다', async () => {
    const c = await attach(); c.subscription.visible(true); frame(1200);
    preference.matches = true; preference.dispatchEvent(new Event('change'));
    expect(c.canvas.dataset.dragonFrame).toBe('0');
    expect(pending.size).toBe(0);
    preference.matches = false; preference.dispatchEvent(new Event('change'));
    expect(pending.size).toBe(1);
  });
  it('GPU 사용 불가/컨텍스트 손실은 공유 2D로 대체하고 복구되면 GPU로 돌아온다', async () => {
    const c = await attach(); mocks.gpu.draw.mockReturnValue(false); c.subscription.visible(true);
    expect(c.canvas.dataset.dragonBackend).toBe('canvas2d');
    expect(mocks.fallback).toHaveBeenCalledTimes(1);
    mocks.gpu.draw.mockReturnValue(true); frame(1200);
    expect(c.canvas.dataset.dragonBackend).toBe('webgl');
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('마지막 칭호 제거 시 프레임/이벤트/GPU 자원을 해제한다', async () => {
    const c = await attach(); c.subscription.visible(true);
    c.subscription.dispose(); disposeAll = [];
    expect(mocks.gpu.dispose).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
    mocks.gpu.draw.mockClear();
    documentState.dispatchEvent(new Event('visibilitychange'));
    preference.dispatchEvent(new Event('change'));
    sources[0].dispatchEvent(new Event('load'));
    expect(mocks.gpu.draw).not.toHaveBeenCalled();
  });
  it('이미지 실패 시 빈 화면을 계속 갱신하지 않는다', async () => {
    const c = await attach(); c.subscription.visible(true);
    sources[0].naturalWidth = 0;
    sources[0].dispatchEvent(new Event('error'));
    expect(pending.size).toBe(0);
  });
  it('모션 감소는 GPU를 만들지 않고 고정 2D 프레임을 재사용한다', async () => {
    preference.matches = true;
    const c = await attach(); c.subscription.visible(true);
    c.subscription.resize(); c.subscription.resize();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.fallback).toHaveBeenCalledTimes(1);
    expect(c.canvas.dataset.dragonSurface).toBe('820x430');
    expect(pending.size).toBe(0);
  });
});
