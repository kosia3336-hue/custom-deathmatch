import type { FileSoundId } from './catalog';

export type PokerAudioSnapshot = {
  round: number; phase: string; pot: number; turnId: string | null;
  myId: string; isPlayer: boolean; skinHandlesBetting?: boolean;
};

/** Pure state diff: initial/reconnected state and restored rounds stay quiet. */
export function pokerAudioEvents(previous: PokerAudioSnapshot | null, next: PokerAudioSnapshot): FileSoundId[] {
  if (!previous || next.round < previous.round || previous.myId !== next.myId || previous.isPlayer !== next.isPlayer) return [];
  const cues: FileSoundId[] = [];
  if (next.round > previous.round && next.phase !== 'finished' && !next.skinHandlesBetting) cues.push('cardDeal');
  else if (next.round === previous.round && next.pot > previous.pot && !next.skinHandlesBetting) {
    cues.push(next.pot - previous.pot > 1 ? 'chipRaise' : 'chipPlace');
  }
  if (next.isPlayer && next.turnId === next.myId && (previous.turnId !== next.turnId || previous.round !== next.round) && !/result|showdown|finished/.test(next.phase)) cues.push('turn');
  return cues;
}

export type CounterAudioSnapshot = { round: number; phase: string; myPick: string | null; keepId: string | null; isSpectator: boolean };
export function counterAudioEvents(previous: CounterAudioSnapshot | null, next: CounterAudioSnapshot): FileSoundId[] {
  if (!previous || next.round < previous.round) return [];
  const cues: FileSoundId[] = [];
  if (!next.isSpectator && next.myPick && next.myPick !== previous.myPick && next.phase === 'picking') cues.push('matchPick');
  if (next.phase !== previous.phase || next.round !== previous.round) {
    if (next.phase === 'reveal') cues.push('matchReveal');
    else if (next.phase === 'burning' && !next.keepId) cues.push('matchEliminate');
    else if (['overlap', 'last'].includes(next.phase) || (next.phase === 'burning' && next.keepId)) {
      const alreadyConfirmed = previous.keepId === next.keepId && previous.round === next.round && ['burning', 'overlap', 'last'].includes(previous.phase);
      if (!alreadyConfirmed) cues.push('matchConfirm');
    }
  }
  return cues;
}
