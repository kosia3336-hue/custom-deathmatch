import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FILE_SOUNDS } from '../../../lib/audio/catalog';
import { counterAudioEvents, pokerAudioEvents, type PokerAudioSnapshot } from '../../../lib/audio/feedback';

const poker: PokerAudioSnapshot = { round: 1, phase: 'betting', pot: 2, turnId: 'other', myId: 'me', isPlayer: true };
const counter = { round: 1, phase: 'picking', myPick: null, keepId: null, isSpectator: false };

describe('server-confirmed audio feedback', () => {
  it('does not replay initial state, identical state or restored rounds', () => {
    expect(pokerAudioEvents(null, poker)).toEqual([]);
    expect(pokerAudioEvents(poker, poker)).toEqual([]);
    expect(pokerAudioEvents({ ...poker, round: 2 }, poker)).toEqual([]);
    expect(pokerAudioEvents(poker, { ...poker, myId: 'reconnected', pot: 5 })).toEqual([]);
  });
  it('plays chips for confirmed payment, including a final call before payout', () => {
    expect(pokerAudioEvents(poker, { ...poker, pot: 3 })).toEqual(['chipPlace']);
    expect(pokerAudioEvents(poker, { ...poker, pot: 8, phase: 'round-result', turnId: null })).toEqual(['chipRaise']);
    expect(pokerAudioEvents(poker, { ...poker, pot: 0, phase: 'round-result', turnId: null })).toEqual([]);
  });
  it('does not confuse antes in a new round with a bet', () => {
    expect(pokerAudioEvents(poker, { ...poker, round: 2, pot: 20 })).toEqual(['cardDeal']);
  });
  it('announces only a new personal turn, never a spectator turn', () => {
    expect(pokerAudioEvents(poker, { ...poker, turnId: 'me' })).toEqual(['turn']);
    expect(pokerAudioEvents({ ...poker, isPlayer: false }, { ...poker, turnId: 'me', isPlayer: false })).toEqual([]);
  });
  it('avoids layering default dealing/betting onto Nocturne skin sounds', () => {
    expect(pokerAudioEvents(poker, { ...poker, pot: 8, skinHandlesBetting: true })).toEqual([]);
  });
  it('counter pick locks only after acknowledgement and not for spectators', () => {
    expect(counterAudioEvents(null, counter)).toEqual([]);
    expect(counterAudioEvents(counter, { ...counter, myPick: 'game-a' })).toEqual(['matchPick']);
    expect(counterAudioEvents(counter, { ...counter, myPick: 'game-a', isSpectator: true })).toEqual([]);
  });
  it('plays separate reveal and elimination sounds', () => {
    const revealed = { ...counter, phase: 'reveal' };
    expect(counterAudioEvents(counter, revealed)).toEqual(['matchReveal']);
    expect(counterAudioEvents(revealed, { ...revealed, phase: 'burning' })).toEqual(['matchEliminate']);
  });
  it('confirms an overlap once across burning and terminal snapshots', () => {
    const confirmed = { ...counter, phase: 'burning', keepId: 'game-a' };
    expect(counterAudioEvents({ ...counter, phase: 'reveal' }, confirmed)).toEqual(['matchConfirm']);
    expect(counterAudioEvents(confirmed, { ...confirmed, phase: 'overlap' })).toEqual([]);
  });
});

describe('sound assets after folder migration', () => {
  it('has unique ids and an existing file for every registered sound', () => {
    expect(new Set(FILE_SOUNDS.map(sound => sound.id)).size).toBe(FILE_SOUNDS.length);
    for (const sound of FILE_SOUNDS) {
      expect(existsSync(resolve(import.meta.dirname, '../../../public', sound.src.slice(1))), sound.src).toBe(true);
    }
  });
});
