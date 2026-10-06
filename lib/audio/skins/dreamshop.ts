import type { BRPSResult, BRPSBetOutcome } from '../../../shared/types/betting-rps';
import type { FileSoundId } from '../catalog';
import { playFileSound } from '../player';
export const DREAMSHOP_SOUND_IDS = [
  'dreamshopWin',
  'dreamshopDraw',
  'dreamshopLose',
  'dreamshopSuccess',
  'dreamshopFail',
  'dreamshopRefund',
] as const satisfies readonly FileSoundId[];
const RESULTS = { win: 'dreamshopWin', draw: 'dreamshopDraw', lose: 'dreamshopLose' } as const;
const OUTCOMES = {
  success: 'dreamshopSuccess',
  fail: 'dreamshopFail',
  refund: 'dreamshopRefund',
} as const;
export function playDreamshopChoice(result: BRPSResult) {
  playFileSound(RESULTS[result]);
}
/** Reveal advances monotonically. Initial/reconnected stages stay silent. */
export function dreamshopRevealSounds(
  previous: number,
  next: number,
  result: BRPSResult | null,
  outcome: BRPSBetOutcome | null,
): FileSoundId[] {
  if (next <= previous) return [];
  const sounds: FileSoundId[] = [];
  if (previous < 1 && next >= 1 && result) sounds.push(RESULTS[result]);
  if (previous < 3 && next >= 3 && outcome) sounds.push(OUTCOMES[outcome]);
  return sounds;
}
