import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSfxOutput,
  getSfxVolume,
  isSfxMuted,
  setSfxMuted,
  setSfxVolume,
} from '../../../lib/sfxSettings';

afterEach(() => vi.unstubAllGlobals());

function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}

describe('효과음 독립 음량', () => {
  it('기존 사용자는 원래 음량을 유지하고 저장 값은 유효 범위로 제한한다', () => {
    const values = storage();
    expect(getSfxVolume()).toBe(1);
    setSfxVolume(0.4);
    expect(getSfxVolume()).toBe(0.4);
    setSfxVolume(2);
    expect(getSfxVolume()).toBe(1);
    values.set('sfx-volume', 'invalid');
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
