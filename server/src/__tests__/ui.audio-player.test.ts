import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const started = vi.fn();
const stopped = vi.fn();
const gains: Array<{ gain: { value: number } }> = [];
class MockAudioContext {
  state = 'running';
  destination = {};
  resume = vi.fn(async () => {});
  decodeAudioData = vi.fn(async () => ({}));
  createGain() { const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; }
  createBufferSource() { return { buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: started, stop: stopped, onended: null }; }
}

beforeEach(() => {
  vi.resetModules(); started.mockClear(); stopped.mockClear(); gains.length = 0;
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() }, addEventListener: vi.fn() });
  vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
});
afterEach(() => vi.unstubAllGlobals());

describe('cached sample playback', () => {
  it('cancels a still-loading sound when leaving the game', async () => {
    let resolveFetch!: (response: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve; })));
    const audio = await import('../../../lib/audio/player');
    audio.playFileSound('cardFlip');
    audio.stopFileAudio();
    resolveFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(started).not.toHaveBeenCalled();
  });
  it('cancels queued playback when effects are muted during loading', async () => {
    let resolveFetch!: (response: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve; })));
    const audio = await import('../../../lib/audio/player');
    const settings = await import('../../../lib/audio/settings');
    audio.playFileSound('cardFlip');
    settings.setSfxMuted(true);
    settings.setSfxMuted(false);
    resolveFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(started).not.toHaveBeenCalled();
  });
  it('coalesces simultaneous card reveals and updates the live master volume', async () => {
    const audio = await import('../../../lib/audio/player');
    const settings = await import('../../../lib/audio/settings');
    audio.playFileSound('cardFlip');
    audio.playFileSound('cardFlip');
    await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    settings.setSfxVolume(.3);
    expect(gains[gains.length - 1].gain.value).toBe(.3);
    audio.stopFileAudio();
    expect(stopped).toHaveBeenCalledTimes(1);
  });
});
