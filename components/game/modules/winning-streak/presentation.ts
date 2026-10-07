import type { WSCardType } from '@/shared/types/winning-streak';
export interface ModalCard {
  type: WSCardType;
  index: number;
}

export const REVEAL_STEPS = [400, 1000, 1700, 2500];
