import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DREAMSHOP_SOUND_IDS, dreamshopRevealSounds } from '../../../lib/audio/skins/dreamshop';
import { FILE_SOUND_BY_ID } from '../../../lib/audio/catalog';

describe('드림샵 스킨 결과 음원', () => {
  it.each(['win', 'draw', 'lose'] as const)('승부 %s를 첫 공개 시 한 번만 재생한다', (result) => {
    expect(dreamshopRevealSounds(0, 1, result, 'success')).toEqual([
      `dreamshop${result[0].toUpperCase() + result.slice(1)}`,
    ]);
    expect(dreamshopRevealSounds(1, 1, result, 'success')).toEqual([]);
    expect(dreamshopRevealSounds(1, 2, result, 'success')).toEqual([]);
  });
  it.each(['success', 'fail', 'refund'] as const)('베팅 %s는 결과 단계에만 재생한다', (outcome) => {
    expect(dreamshopRevealSounds(2, 3, 'win', outcome)).toEqual([
      `dreamshop${outcome[0].toUpperCase() + outcome.slice(1)}`,
    ]);
    expect(dreamshopRevealSounds(3, 3, 'win', outcome)).toEqual([]);
    expect(dreamshopRevealSounds(3, 0, 'win', outcome)).toEqual([]);
  });
  it('일시적인 렌더 지연에 여러 단계를 넘어도 두 의미별 cue만 재생한다', () => {
    expect(dreamshopRevealSounds(0, 3, 'draw', 'refund')).toEqual([
      'dreamshopDraw',
      'dreamshopRefund',
    ]);
    expect(dreamshopRevealSounds(0, 3, null, null)).toEqual([]);
  });
  it('6종 음원이 서로 다르고 WAV 형식·길이·피크·경로가 유효하다', () => {
    const paths = DREAMSHOP_SOUND_IDS.map((id) => FILE_SOUND_BY_ID[id].src);
    expect(new Set(paths).size).toBe(6);
    for (const id of DREAMSHOP_SOUND_IDS) {
      const bytes = readFileSync(resolve('..', 'public', FILE_SOUND_BY_ID[id].src.slice(1)));
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
      expect(bytes.readUInt16LE(22)).toBe(1);
      expect(bytes.readUInt32LE(24)).toBe(44100);
      expect(bytes.readUInt16LE(34)).toBe(16);
      const duration = bytes.readUInt32LE(40) / (44100 * 2);
      expect(duration).toBeGreaterThan(0.3);
      expect(duration).toBeLessThan(0.8);
      let peak = 0;
      for (let i = 44; i < bytes.length; i += 2)
        peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)) / 32767);
      expect(peak).toBeGreaterThan(0.6);
      expect(peak).toBeLessThan(0.63);
      expect(Math.abs(bytes.readInt16LE(44))).toBeLessThan(5);
      expect(Math.abs(bytes.readInt16LE(bytes.length - 2))).toBeLessThan(5);
    }
  });
});
