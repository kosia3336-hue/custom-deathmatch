/** 콰트로 — 게임 모듈 엔트리 (init / handleAction / cleanup). */
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  QUATRO_VP_COUNT,
  type QuatroAction,
} from '@shared/types/quatro.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { maybeScheduleAi } from './ai.js';
import {
  gameStates,
  createState,
  playerIdxById,
  currentMulliganIdx,
  currentExchangeIdx,
  isLastExchangePhase,
  applyMulligan,
  startRounds,
  beginExchangePhase,
  commitOpens,
  endExchangePhase,
  applyExchange,
  buildGameData,
  broadcastState,
  emitStateToSocketImpl,
  finishGame,
  armTimer,
  clearTimer,
  type EndGameFn,
  type QuatroState,
} from './state.js';

export function initQuatro(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  _timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearTimer(prev);
  gameStates.delete(roomId);

  const s = createState(roomId, players, playMode, startedAt, endGameCallback);
  gameStates.set(roomId, s);

  advance(io, s);
}

/** 페이즈 자동 전이 + 타이머 재장전 + 브로드캐스트 */
function advance(io: IO, s: QuatroState) {
  if (s.gameOver) return;

  if (s.phase === 'mulligan') {
    const idx = currentMulliganIdx(s);
    if (idx === -1) {
      startRounds(s);
      return advance(io, s);
    }
    armTimer(io, s, (io2, s2) => {
      // 시간 초과 → 멀리건 거부 처리
      const cur = currentMulliganIdx(s2);
      if (cur !== -1) applyMulligan(s2, cur, false);
      s2.mulliganQueue.shift();
      advance(io2, s2);
    });
  } else if (s.phase === 'open') {
    const pending = s.players.filter((p) => !p.openChoice);
    if (pending.length === 0) {
      commitOpens(s);
      if (s.round >= 4) {
        finishGame(io, s);
        return;
      }
      beginExchangePhase(s);
      return advance(io, s);
    }
    armTimer(io, s, (io2, s2) => {
      // 시간 초과 → 미선택 플레이어는 무작위 비공개 카드 오픈
      for (const p of s2.players) {
        if (!p.openChoice) {
          const closed = p.hand.filter((c) => !p.openIds.has(c.id));
          p.openChoice = closed[Math.floor(Math.random() * closed.length)]?.id ?? null;
        }
      }
      advance(io2, s2);
    });
  } else if (s.phase === 'exchange') {
    const idx = currentExchangeIdx(s);
    if (idx === -1) {
      endExchangePhase(s);
      return advance(io, s);
    }
    armTimer(io, s, (io2, s2) => {
      const cur = currentExchangeIdx(s2);
      if (cur === -1) return advance(io2, s2);
      const p = s2.players[cur];
      const must = isLastExchangePhase(s2) && p.usedVps.size < QUATRO_VP_COUNT;
      if (must) {
        // 강제 무작위 교환
        const vpIdx = [...Array(QUATRO_VP_COUNT).keys()].find((i) => !p.usedVps.has(i));
        const closed = p.hand.filter((c) => !p.openIds.has(c.id));
        if (vpIdx !== undefined && closed.length > 0) {
          applyExchange(s2, cur, vpIdx, closed[Math.floor(Math.random() * closed.length)]!.id);
        } else {
          p.stopped = true;
        }
      } else {
        if (!s2.firstStopperId) s2.firstStopperId = p.id;
        p.stopped = true;
      }
      s2.turnPtr++;
      advance(io2, s2);
    });
  }

  void broadcastState(io, s);

  // COM 모드 — AI 차례면 예약 실행
  maybeScheduleAi(io, s, applyAiAction, currentMulliganIdx, currentExchangeIdx);
}

/** AI 액션 적용 — handleQuatroAction 의 검증 로직과 동일 경로 */
function applyAiAction(
  io: IO,
  s: QuatroState,
  idx: number,
  action:
    | { type: 'mulligan'; use: boolean }
    | { type: 'open'; cardId: string }
    | { type: 'exchange'; vpIndex: number; giveCardId: string }
    | { type: 'stop' },
) {
  if (idx === -1 || s.gameOver) return;
  const p = s.players[idx];
  switch (action.type) {
    case 'mulligan': {
      if (s.phase !== 'mulligan' || currentMulliganIdx(s) !== idx) return;
      applyMulligan(s, idx, action.use);
      s.mulliganQueue.shift();
      advance(io, s);
      return;
    }
    case 'open': {
      if (s.phase !== 'open' || p.openChoice) return;
      const card = p.hand.find((c) => c.id === action.cardId);
      if (!card || p.openIds.has(card.id)) return;
      p.openChoice = card.id;
      advance(io, s);
      return;
    }
    case 'exchange': {
      if (s.phase !== 'exchange' || currentExchangeIdx(s) !== idx) return;
      const err = applyExchange(s, idx, action.vpIndex, action.giveCardId);
      if (err) {
        // 실패 시 스탑으로 폴백 (교착 방지)
        if (!s.firstStopperId) s.firstStopperId = p.id;
        p.stopped = true;
      }
      s.turnPtr++;
      advance(io, s);
      return;
    }
    case 'stop': {
      if (s.phase !== 'exchange' || currentExchangeIdx(s) !== idx) return;
      if (isLastExchangePhase(s) && p.usedVps.size < QUATRO_VP_COUNT) {
        // 의무 교환 남음 — 강제 무작위 교환
        const vpIdx = [...Array(QUATRO_VP_COUNT).keys()].find((i) => !p.usedVps.has(i));
        const closed = p.hand.filter((c) => !p.openIds.has(c.id));
        if (vpIdx !== undefined && closed.length > 0) {
          applyExchange(s, idx, vpIdx, closed[0]!.id);
        } else {
          p.stopped = true;
        }
      } else {
        if (!s.firstStopperId) s.firstStopperId = p.id;
        p.stopped = true;
      }
      s.turnPtr++;
      advance(io, s);
      return;
    }
  }
}

export function handleQuatroAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const pid = sessions.getToken(socket.id) ?? socket.id;
  const idx = playerIdxById(s, pid);
  if (idx === -1) return;
  const p = s.players[idx];
  const action = data as QuatroAction;

  switch (action.type) {
    case 'mulligan': {
      if (s.phase !== 'mulligan') return;
      if (currentMulliganIdx(s) !== idx) {
        socket.emit('error', { message: '멀리건 차례가 아닙니다.' });
        return;
      }
      applyMulligan(s, idx, Boolean(action.use));
      s.mulliganQueue.shift();
      advance(io, s);
      return;
    }
    case 'open': {
      if (s.phase !== 'open') return;
      if (p.openChoice) return;
      const card = p.hand.find((c) => c.id === action.cardId);
      if (!card || p.openIds.has(card.id)) {
        socket.emit('error', { message: '오픈할 수 없는 카드입니다.' });
        return;
      }
      p.openChoice = card.id;
      advance(io, s);
      return;
    }
    case 'exchange': {
      if (s.phase !== 'exchange') return;
      if (currentExchangeIdx(s) !== idx) {
        socket.emit('error', { message: '교환 차례가 아닙니다.' });
        return;
      }
      const vpIndex = Number(action.vpIndex);
      if (!Number.isInteger(vpIndex) || vpIndex < 0 || vpIndex >= QUATRO_VP_COUNT) return;
      const err = applyExchange(s, idx, vpIndex, String(action.giveCardId));
      if (err) {
        socket.emit('error', { message: err });
        return;
      }
      s.turnPtr++;
      advance(io, s);
      return;
    }
    case 'stop': {
      if (s.phase !== 'exchange') return;
      if (currentExchangeIdx(s) !== idx) {
        socket.emit('error', { message: '차례가 아닙니다.' });
        return;
      }
      if (isLastExchangePhase(s) && p.usedVps.size < QUATRO_VP_COUNT) {
        socket.emit('error', {
          message: `마지막 교환입니다 — 남은 가상 플레이어 ${QUATRO_VP_COUNT - p.usedVps.size}명과 모두 교환해야 해요.`,
        });
        return;
      }
      if (!s.firstStopperId) s.firstStopperId = p.id;
      p.stopped = true;
      s.turnPtr++;
      advance(io, s);
      return;
    }
  }
}

export function cleanupQuatro(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTimer(s);
  gameStates.delete(roomId);
}

export function getQuatroState(roomId: string) {
  const s = gameStates.get(roomId);
  return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
}

export function emitQuatroStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (s) emitStateToSocketImpl(socket, s);
}

export function performQuatroUndo(_io: IO, _roomId: string): boolean {
  return false;
}

export function canQuatroUndo(_roomId: string): boolean {
  return false;
}

export function getQuatroResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  return s?.result ? { result: s.result } : undefined;
}

/** buildGameData 재수출 (관전 뷰 등에서 사용 가능) */
export { buildGameData };
