import { playFileSound } from './player';

/** Confirmed stone/piece move, shared by abstract strategy games. */
export function playAbstractStrategyMoveSfx() {
  playFileSound('boardMove');
}
