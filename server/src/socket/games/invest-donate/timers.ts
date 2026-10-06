import type { InternalState } from './types.js';
import { gameStates } from './store.js';

export function clearRoundTimer(s: InternalState) {
  if (s.roundTimer !== null) clearTimeout(s.roundTimer);
  s.roundTimer = null;
}

export function clearGameTimers(s: InternalState) {
  clearRoundTimer(s);
  if (s.transitionTimer !== null) clearTimeout(s.transitionTimer);
  s.transitionTimer = null;
}

/** A callback belongs to one state object and one undo generation. */
export function scheduleTransition(s: InternalState, delayMs: number, callback: () => void) {
  if (s.transitionTimer !== null) clearTimeout(s.transitionTimer);
  const generation = s.aiGeneration;
  s.transitionTimer = setTimeout(() => {
    if (gameStates.get(s.roomId) !== s || s.aiGeneration !== generation) return;
    s.transitionTimer = null;
    callback();
  }, delayMs);
}

export function armRoundTimer(s: InternalState, callback: () => void) {
  clearRoundTimer(s);
  s.turnStartedAt = Date.now();
  if (!s.timeLimitSeconds) return;
  const generation = s.aiGeneration;
  s.roundTimer = setTimeout(() => {
    if (
      gameStates.get(s.roomId) !== s ||
      s.aiGeneration !== generation ||
      s.phase !== 'submit' ||
      s.gameOver
    )
      return;
    s.roundTimer = null;
    callback();
  }, s.timeLimitSeconds * 1000);
}
