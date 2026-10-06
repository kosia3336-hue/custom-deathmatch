/** 판 수명에 묶인 타이머. 같은 방 id의 새 경기까지 이전 콜백이 실행되지 않는다. */
import type { InternalState } from './types.js';
import { gameStates } from './store.js';

export function clearRoundTimer(s: InternalState) {
  if (s.roundTimer) clearTimeout(s.roundTimer);
  s.roundTimer = null;
}
export function clearTransitionTimer(s: InternalState) {
  if (s.transitionTimer) clearTimeout(s.transitionTimer);
  s.transitionTimer = null;
}
export function clearGameTimers(s: InternalState) {
  clearRoundTimer(s);
  clearTransitionTimer(s);
}
export function armRoundTimer(s: InternalState, onTimeout: () => void) {
  clearRoundTimer(s);
  if (!s.timeLimitSeconds) return;
  s.turnStartedAt = Date.now();
  const generation = s.aiGeneration;
  s.roundTimer = setTimeout(() => {
    s.roundTimer = null;
    if (
      gameStates.get(s.roomId) !== s ||
      s.aiGeneration !== generation ||
      s.gameOver ||
      s.phase !== 'submit'
    )
      return;
    onTimeout();
  }, s.timeLimitSeconds * 1000);
}
export function scheduleTransition(s: InternalState, delayMs: number, onTransition: () => void) {
  clearTransitionTimer(s);
  const generation = s.aiGeneration;
  s.transitionTimer = setTimeout(() => {
    s.transitionTimer = null;
    if (gameStates.get(s.roomId) !== s || s.aiGeneration !== generation) return;
    onTransition();
  }, delayMs);
}
