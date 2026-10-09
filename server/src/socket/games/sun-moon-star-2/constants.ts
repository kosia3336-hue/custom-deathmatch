import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';

export {
  SMS2_MAX_ROUNDS,
  SMS2_INITIAL_POWDER,
  SMS2_INITIAL_CHIPS,
  SMS2_POWDER_STAGE_SIZE,
  MARK_IDS,
} from '@shared/types/sun-moon-star-2.js';
import { SMS2_REVEAL_DONE_MS, SMS2_RESOLVE_READ_HOLD_MS } from '@shared/types/sun-moon-star-2.js';

/* 정산 대기 — 화면 결과판이 다 뜬 뒤 읽을 시간까지 (값: shared/types/sun-moon-star-2.ts) */
export const RESOLVE_HOLD_MS = SMS2_REVEAL_DONE_MS + SMS2_RESOLVE_READ_HOLD_MS;

/* 라운드 전환 / 마감 */
export const ROUND_END_HOLD_MS = 3000;
/** 결과판은 정산 대기 동안 이미 읽었다 — 다음 라운드로 넘어가기 전 짧게만 둔다 */
export const NEXT_ROUND_AUTO_DELAY_MS = 1500;
export const FINAL_RESULT_HOLD_MS = 3000;
export const SUDDEN_DEATH_INTRO_MS = 2200;

/* 기본 라운드 타임리밋 (timeLimitSeconds가 null인 경우 사용 안 함) */
export const DEFAULT_ROUND_TIMEOUT_SEC = 30;

export const AI_THINK_DELAY = { min: 700, max: 1600 };

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
