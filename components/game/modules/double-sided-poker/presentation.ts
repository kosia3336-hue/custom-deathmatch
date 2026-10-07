import type { DoubleSidedPokerSide } from '@/shared/types/double-sided-poker';
export const SELECTION_LABEL = {
  front: '앞면',
  back: '뒷면',
  both: '양면',
} as const;

export type DoubleSidedPokerBranch = DoubleSidedPokerSide | 'both';

export const BRANCH_LABEL: Record<DoubleSidedPokerBranch, string> = {
  front: '앞면 선택',
  back: '뒷면 선택',
  both: '양면 선택',
};
