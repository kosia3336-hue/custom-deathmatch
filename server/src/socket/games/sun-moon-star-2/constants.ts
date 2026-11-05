import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  SMS2_MAX_ROUNDS,
  SMS2_INITIAL_POWDER,
  SMS2_INITIAL_CHIPS,
  SMS2_POWDER_STAGE_SIZE,
  MARK_IDS,
} from '@shared/types/sun-moon-star-2.js';
/* 정산 대기 — 화면 정산 단계가 다 뜬 뒤 읽을 시간까지 (값: shared/types/sun-moon-star-2.ts) */
export { sms2ResolveHoldMs } from '@shared/types/sun-moon-star-2.js';

/* 라운드 전환 / 마감 */
export const ROUND_END_HOLD_MS = 3000;
export const NEXT_ROUND_AUTO_DELAY_MS = 3500;
export const FINAL_RESULT_HOLD_MS = 3000;
export const SUDDEN_DEATH_INTRO_MS = 2200;

/* 기본 라운드 타임리밋 (timeLimitSeconds가 null인 경우 사용 안 함) */
export const DEFAULT_ROUND_TIMEOUT_SEC = 30;

export const AI_THINK_DELAY = { min: 700, max: 1600 };

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
