import type { InternalState, BRPSPlayerInternal } from './types.js';
import { BRPS_INITIAL_CHIPS } from './constants.js';

export function getChoiceRightId(s: InternalState): string {
  return s.round % 2 === 1 ? s.player1.id : s.player2.id;
}

export function getPlayer(s: InternalState, id: string): BRPSPlayerInternal | null {
  if (s.player1.id === id) return s.player1;
  if (s.player2.id === id) return s.player2;
  return null;
}

export function getOpponent(s: InternalState, id: string): BRPSPlayerInternal | null {
  if (s.player1.id === id) return s.player2;
  if (s.player2.id === id) return s.player1;
  return null;
}

export function makePlayer(id: string, nickname: string): BRPSPlayerInternal {
  return {
    id,
    nickname,
    chips: BRPS_INITIAL_CHIPS,
    role: null,
    hasChoiceRight: false, // set after both players created
    submitted: false,
    matchResult: null,
    prediction: null,
    betChips: null,
  };
}

export function assignRoles(s: InternalState, choiceId: string, role: 'match' | 'bet') {
  const otherId = choiceId === s.player1.id ? s.player2.id : s.player1.id;
  const choicePlayer = getPlayer(s, choiceId)!;
  const otherPlayer = getPlayer(s, otherId)!;
  choicePlayer.role = role;
  otherPlayer.role = role === 'match' ? 'bet' : 'match';
}
