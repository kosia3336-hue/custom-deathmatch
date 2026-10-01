import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSfxOutput,
  getSfxVolume,
  isSfxMuted,
  setSfxMuted,
  setSfxVolume,
  subscribeSfxSettings,
} from '../../../lib/sfxSettings';

afterEach(() => vi.unstubAllGlobals());

/** window 를 새로 끼운다 — 저장소는 window 가 바뀌면 캐시를 버리고 다시 읽는다. */
function storage(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));
  const handlers: ((e: { key: string | null }) => void)[] = [];
  const getItem = vi.fn((key: string) => values.get(key) ?? null);
  vi.stubGlobal('window', {
    localStorage: {
      getItem,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    addEventListener: (_type: string, cb: (e: { key: string | null }) => void) => handlers.push(cb),
  });
  return { values, handlers, getItem };
}

describe('효과음 독립 음량', () => {
  it('기존 사용자는 원래 음량을 유지하고 저장 값은 유효 범위로 제한한다', () => {
    storage();
    expect(getSfxVolume()).toBe(1);
    setSfxVolume(0.4);
    expect(getSfxVolume()).toBe(0.4);
    setSfxVolume(2);
    expect(getSfxVolume()).toBe(1);
    storage({ 'sfx-volume': 'invalid' });
    expect(getSfxVolume()).toBe(1);
  });

  it('음소거와 음량 변경은 이미 재생 중인 합성 효과음에도 즉시 반영한다', () => {
    storage();
    const output = { gain: { value: 1 }, connect: vi.fn() };
    const ctx = { state: 'running', destination: {}, createGain: () => output };
    expect(getSfxOutput(ctx as unknown as AudioContext)).toBe(output);
    setSfxVolume(0.25);
    expect(output.gain.value).toBe(0.25);
    setSfxMuted(true);
    expect(output.gain.value).toBe(0);
    expect(getSfxVolume()).toBe(0.25);
    setSfxMuted(false);
    expect(output.gain.value).toBe(0.25);
    ctx.state = 'closed';
    setSfxVolume(1);
  });

  it('재생할 때마다 스토리지를 다시 읽지 않고, 같은 값은 다시 알리지 않는다', () => {
    const { getItem } = storage({ 'sfx-volume': '0.6' });
    for (let i = 0; i < 100; i++) {
      getSfxVolume();
      isSfxMuted();
    }
    expect(getItem).toHaveBeenCalledTimes(2);
    const cb = vi.fn();
    const off = subscribeSfxSettings(cb);
    setSfxVolume(0.6);
    expect(cb).not.toHaveBeenCalled();
    setSfxVolume(0.7);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('음량이 사실상 0 인 채로 음소거를 풀면 기본 음량으로 되돌린다', () => {
    const { values } = storage({ 'sfx-muted': '1', 'sfx-volume': '0' });
    setSfxMuted(false);
    expect(isSfxMuted()).toBe(false);
    expect(getSfxVolume()).toBe(1);
    expect(values.get('sfx-volume')).toBe('1');
  });

  it('다른 탭에서 바꾼 값은 storage 이벤트로 받아 온다', async () => {
    const { values, handlers } = storage();
    // 모듈이 한 번만 리스너를 달기 때문에, 이미 달린 경우를 대비해 새로 import 한다.
    vi.resetModules();
    const fresh = await import('../../../lib/sfxSettings');
    const cb = vi.fn();
    const off = fresh.subscribeSfxSettings(cb);
    expect(fresh.getSfxVolume()).toBe(1);
    values.set('sfx-volume', '0.3');
    handlers.forEach((h) => h({ key: 'bgm-volume' }));
    expect(cb).not.toHaveBeenCalled();
    handlers.forEach((h) => h({ key: 'sfx-volume' }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(fresh.getSfxVolume()).toBe(0.3);
    off();
  });

  it('스토리지 차단 환경에서도 게임을 중단시키지 않는다', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('blocked');
      },
    });
    expect(getSfxVolume()).toBe(1);
    expect(isSfxMuted()).toBe(false);
    expect(() => setSfxVolume(0.5)).not.toThrow();
  });
});
