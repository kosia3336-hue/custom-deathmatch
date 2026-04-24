import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  GS2_TOTAL_ROUNDS,
  GS2_EXTENDED_ROUNDS,
  GS2_INITIAL_SUGAR,
  GS2_HR_PENALTY,
  CARD_IDS,
  CARD_META,
  CARD_LABELS,
} from '@shared/types/grape-sugar-2.js';

/** 양측 제출 직후 reveal 페이즈로 전환되고, 정산 단계 애니메이션이 끝난 뒤 roundEnd로 진입하기까지 대기. */
export const REVEAL_BASE_DELAY_MS = 800;
export const RESOLVE_STEP_DELAY_MS = 1100;
export const ROUND_END_HOLD_MS = 2000;
export const NEXT_ROUND_AUTO_DELAY_MS = 2500;
export const EXTENSION_INTRO_MS = 2000;
export const FINAL_RESULT_HOLD_MS = 2500;

export const AI_THINK_DELAY = { min: 600, max: 1400 };

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
