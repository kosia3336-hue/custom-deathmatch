import { scheduleTurnExpiry } from '../../gameTurnExpiry.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { InternalState } from './types.js';
import type { IO } from './constants.js';
import { gameStates } from './store.js';

export function clearTurnTimer(s: InternalState) {
  if (s.turnTimer) {
    clearTimeout(s.turnTimer);
    s.turnTimer = null;
  }
}

export function armTurnTimer(io: IO, s: InternalState, onTimeout: () => void) {
  clearTurnTimer(s);
  if (!s.timeLimitSeconds) return;
  if (s.currentTurnId === AI_PLAYER_ID) return;
  s.turnStartedAt = Date.now();
  s.turnTimer = scheduleTurnExpiry(
    io,
    s,
    'turnTimer',
    () => s.currentTurnId,
    () => {
      if (gameStates.get(s.roomId) === s) onTimeout();
    },
    s.timeLimitSeconds * 1000,
  );
}

export function clearTransitionTimers(s: InternalState) {
  if (s.nextRoundTimer) clearTimeout(s.nextRoundTimer);
  if (s.finishTimer) clearTimeout(s.finishTimer);
  s.nextRoundTimer = null;
  s.finishTimer = null;
}
export function clearGameTimers(s: InternalState) {
  clearTurnTimer(s);
  clearTransitionTimers(s);
  s.aiGeneration++;
}
export function scheduleTransition(
  s: InternalState,
  kind: 'nextRoundTimer' | 'finishTimer',
  milliseconds: number,
  run: () => void,
) {
  if (s[kind]) clearTimeout(s[kind]);
  const generation = s.aiGeneration;
  s[kind] = setTimeout(() => {
    s[kind] = null;
    if (gameStates.get(s.roomId) !== s || s.aiGeneration !== generation) return;
    run();
  }, milliseconds);
}
