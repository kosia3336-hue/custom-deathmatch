import { randomUUID } from 'node:crypto';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { isDummyPlayerId } from '@shared/dummy.js';
import type { GameTimeExpiry } from '@shared/types/events.js';
import { roomStore } from '../store/rooms.js';
import { socketRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';

type TimedState = {
  roomId: string;
  gameOver: boolean;
  turnStartedAt: number | null;
  roundDeadline?: number | null;
};
type Pending = { data: GameTimeExpiry; resume: () => void; valid: () => boolean };
const pending = new Map<string, Pending>();
const active = new Map<string, { deadline: number; expire: () => void; valid: () => boolean }>();
let runtime:
  | {
      finish: (io: IO, roomId: string, loserId: string) => void;
      sync: (io: IO, roomId: string) => void;
      pause?: (roomId: string) => void;
    }
  | undefined;

export function configureTurnExpiryRuntime(value: NonNullable<typeof runtime>) {
  runtime = value;
}

export function clearTurnExpiry(io: IO, roomId: string) {
  active.delete(roomId);
  if (pending.delete(roomId)) io.to(socketRoom(roomId)).emit('game:time-expiry', null);
}

export function emitTurnExpiry(socket: TypedSocket, roomId: string) {
  socket.emit('game:time-expiry', pending.get(roomId)?.data ?? null);
}

/** 액션보다 먼저 서버 마감 시각을 검사한다. 클라이언트 타이머는 판정에 사용하지 않는다. */
export function isTurnExpiryBlocked(roomId: string): boolean {
  const timer = active.get(roomId);
  const expired = timer?.valid() && Date.now() >= timer.deadline;
  if (expired) timer.expire();
  return pending.has(roomId) || (expired === true && roomStore.get(roomId)?.status !== 'playing');
}

export function respondTurnExpiry(
  io: IO,
  roomId: string,
  playerId: string,
  requestId: string,
  decision: string,
) {
  const p = pending.get(roomId);
  const room = roomStore.get(roomId);
  if (!p || !room || room.status !== 'playing' || !p.valid()) return;
  if (p.data.requestId !== requestId || p.data.deciderId !== playerId) return;
  if (!room.players.some((player) => player.id === playerId)) return;
  if (decision !== 'continue' && decision !== 'finish') return;
  clearTurnExpiry(io, roomId);
  if (decision === 'continue') p.resume();
  else runtime?.finish(io, roomId, p.data.loserId);
}

/**
 * 개인 착수 타이머만 연결한다. 공동 단계는 actor()가 null이면 원래 종료 규칙을 유지한다.
 * 기존 타이머 필드에 핸들을 저장하므로 각 게임의 clearTimeout/cleanup/undo 계약도 유지한다.
 */
export function scheduleTurnExpiry<S extends TimedState, K extends keyof S>(
  io: IO,
  state: S,
  timerKey: K,
  actor: () => string | null,
  fallback: () => void,
  milliseconds: number,
): ReturnType<typeof setTimeout> {
  const playerId = actor();
  const room = roomStore.get(state.roomId);
  if (
    !playerId ||
    playerId === AI_PLAYER_ID ||
    !runtime ||
    !room ||
    room.players.length !== 2 ||
    (room.playMode !== 'multi' && room.playMode !== 'com')
  ) {
    return setTimeout(fallback, milliseconds);
  }
  const opponent = room.players.find((player) => player.id !== playerId);
  if (!opponent) return setTimeout(fallback, milliseconds);
  let fired = false;
  const valid = () =>
    !state.gameOver && state[timerKey] === (handle as unknown as S[K]) && actor() === playerId;
  const expire = () => {
    if (fired || !valid()) return;
    fired = true;
    clearTimeout(handle);
    const currentRoom = roomStore.get(state.roomId);
    if (!currentRoom || currentRoom.status !== 'playing') return;
    active.delete(state.roomId);
    if (currentRoom.isRanked || (isDummyPlayerId(playerId) && isDummyPlayerId(opponent.id))) {
      runtime!.finish(io, state.roomId, playerId);
      return;
    }
    // 일반 방에 들어온 운영 더미도 선택창을 조작할 수 없으므로 COM처럼 봐주기를 제공한다.
    const selfDecision = currentRoom.playMode === 'com' || isDummyPlayerId(opponent.id);
    const data: GameTimeExpiry = {
      roomId: state.roomId,
      requestId: randomUUID(),
      loserId: playerId,
      deciderId: selfDecision ? playerId : opponent.id,
      mode: selfDecision ? 'com' : 'multi',
    };
    runtime!.pause?.(state.roomId);
    pending.set(state.roomId, {
      data,
      valid,
      resume: () => {
        state.turnStartedAt = Date.now();
        if ('roundDeadline' in state) state.roundDeadline = Date.now() + milliseconds;
        state[timerKey] = scheduleTurnExpiry(
          io,
          state,
          timerKey,
          actor,
          fallback,
          milliseconds,
        ) as unknown as S[K];
        runtime!.sync(io, state.roomId);
      },
    });
    io.to(socketRoom(state.roomId)).emit('game:time-expiry', data);
  };
  const handle = setTimeout(expire, milliseconds);
  active.set(state.roomId, { deadline: Date.now() + milliseconds, expire, valid });
  return handle;
}
