import { playFileSound } from './player';

/** Pot payout; the original Kenney chips-handle-5 source is retained as PCM WAV. */
export function playChipsSfx(volume = .55) {
  playFileSound('chipCollect', volume);
}
