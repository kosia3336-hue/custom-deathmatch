import { describe, expect, it } from 'vitest';
import { decideLitMarkSmsEvent, scoreSeatRound } from '@shared/types/sun-moon-star-event.js';

describe('decideLitMarkSmsEvent', () => {
  it('unique min', () => {
    const r = decideLitMarkSmsEvent({ sun: 1, moon: 3, star: 4 });
    expect(r).toEqual({ kind: 'lit', mark: 'sun', reason: 'unique_min' });
  });

  it('anti tie two mins', () => {
    const r = decideLitMarkSmsEvent({ sun: 2, moon: 2, star: 4 });
    expect(r).toEqual({ kind: 'lit', mark: 'star', reason: 'anti_tie' });
  });

  it('triple tie void', () => {
    const r = decideLitMarkSmsEvent({ sun: 2, moon: 2, star: 2 });
    expect(r).toEqual({ kind: 'void', reason: 'triple_tie' });
  });

  it('all same pick anti tie', () => {
    const r = decideLitMarkSmsEvent({ sun: 8, moon: 0, star: 0 });
    expect(r).toEqual({ kind: 'lit', mark: 'sun', reason: 'anti_tie' });
  });
});

describe('scoreSeatRound', () => {
  const litSun = { kind: 'lit' as const, mark: 'sun' as const, reason: 'unique_min' as const };

  it('maintain no bonus', () => {
    expect(scoreSeatRound('sun', 'sun', litSun)).toBe(1);
  });

  it('changed win bonus', () => {
    expect(scoreSeatRound('moon', 'sun', litSun)).toBe(3);
  });

  it('maintained wrong mark', () => {
    expect(scoreSeatRound('moon', 'moon', litSun)).toBe(0);
  });

  it('changed wrong mark penalty', () => {
    expect(scoreSeatRound('moon', 'star', litSun)).toBe(-1);
  });
});
