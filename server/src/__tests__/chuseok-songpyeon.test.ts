import { describe, expect, it } from 'vitest';
import { isChuseok2026Open, songpyeonForRankedResult } from '@shared/event/chuseok.js';

describe('2026 한가위 송편', () => {
  it('랭크 결과는 승 3, 무 2, 패 1, 기권패 0이다', () => {
    expect(songpyeonForRankedResult({ outcome: 'win', forfeit: false })).toBe(3);
    expect(songpyeonForRankedResult({ outcome: 'draw', forfeit: false })).toBe(2);
    expect(songpyeonForRankedResult({ outcome: 'loss', forfeit: false })).toBe(1);
    expect(songpyeonForRankedResult({ outcome: 'loss', forfeit: true })).toBe(0);
    expect(songpyeonForRankedResult({ outcome: 'win', forfeit: true })).toBe(3);
  });

  it('9월 27일 21시부터 10월 12일 새벽 1시 전까지만 열린다', () => {
    expect(isChuseok2026Open(Date.parse('2026-09-27T20:59:00+09:00'))).toBe(false);
    expect(isChuseok2026Open(Date.parse('2026-09-27T21:00:00+09:00'))).toBe(true);
    expect(isChuseok2026Open(Date.parse('2026-10-12T00:59:00+09:00'))).toBe(true);
    expect(isChuseok2026Open(Date.parse('2026-10-12T01:00:00+09:00'))).toBe(false);
  });
});
