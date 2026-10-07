import type { GS2ResolveStep } from '@/shared/types/grape-sugar-2';

export function computeLiveSugar(
  steps: GS2ResolveStep[],
  cursor: number,
): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  const revealStep = steps[0];
  if (revealStep?.type === 'reveal') {
    p1 = revealStep.actions.p1.sugar;
    p2 = revealStep.actions.p2.sugar;
  }
  for (let i = 1; i < cursor; i++) {
    const s = steps[i];
    if (s.type === 'cancel') {
      if (s.targetSide === 'p1') p1 = 0;
      else p2 = 0;
    } else if (s.type === 'effect') {
      if (s.targetSide === 'p1') p1 = s.after;
      else p2 = s.after;
    } else if (s.type === 'final') {
      p1 = s.roundSugar.p1;
      p2 = s.roundSugar.p2;
    }
  }
  return { p1, p2 };
}
