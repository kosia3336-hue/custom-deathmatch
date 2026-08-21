import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { SBNWAction, SBNWTile } from '@shared/types/silper-bnw.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, InternalState } from './types.js';
import {
  broadcastState,
  canSilperBnwUndoState,
  clearRoundTimer,
  emitStateToSocket,
  gameStates,
  handleSilperBnwLeave,
  makePlayer,
  processFirstSubmit,
  processSecondSubmit,
  performSilperBnwUndo,
  getSilperBnwResultData,
  startFirstSubmitTimer,
} from './state.js';
import { aiSubmitFirst, aiSubmitSecond } from './ai.js';

export { performSilperBnwUndo, handleSilperBnwLeave, getSilperBnwResultData };
export type { EndGameFn };

const ERROR_MESSAGES: Record<string, string> = {
  empty: '제시할 타일을 선택해 주세요.',
  leadingZero: '맨 앞 자리에 0을 둘 수 없습니다.',
  invalidTile: '유효하지 않은 타일입니다.',
  tileOverflow: '보유한 수량을 초과했습니다.',
  phaseMismatch: '지금은 제시 단계가 아닙니다.',
  notYourTurn: '당신의 차례가 아닙니다.',
};

export function initSilperBnw(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearRoundTimer(prev);
  gameStates.delete(roomId);

  const p1 = makePlayer(players[0].id, players[0].nickname);
  const p2 = makePlayer(players[1].id, players[1].nickname);
  const firstPlayerId = p1.id;

  const s: InternalState = {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'firstSubmit',
    firstPlayerId,
    rematchIndex: 0,
    player1: p1,
    player2: p2,
    firstTiles: null,
    firstDigits: null,
    secondTiles: null,
    actionLog: [],
    segmentsHistory: [],
    winner: null,
    winType: null,
    finishReason: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    roundTimer: null,
    playMode,
    gameOver: false,
    aiGeneration: 0,
    undoSnapshots: [],
    consecutiveTimeouts: { [p1.id]: 0, [p2.id]: 0 },
    lastAutoSubmittedBy: null,
  };

  gameStates.set(roomId, s);

  if (playMode === 'com') {
    s.onAITurn = (ioRef, state) => {
      if (state.phase === 'firstSubmit' && state.firstPlayerId === AI_PLAYER_ID) {
        aiSubmitFirst(ioRef, state);
      } else if (state.phase === 'secondSubmit' && state.firstPlayerId !== AI_PLAYER_ID) {
        aiSubmitSecond(ioRef, state);
      }
    };
  }

  // 첫 라운드 시작 스냅샷
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    rematchIndex: s.rematchIndex,
    firstPlayerId: s.firstPlayerId,
    firstTiles: null,
    firstDigits: null,
    player1: {
      score: p1.score,
      tiles: { ...p1.tiles },
      tileCount: p1.tileCount,
      submitted: p1.submitted,
    },
    player2: {
      score: p2.score,
      tiles: { ...p2.tiles },
      tileCount: p2.tileCount,
      submitted: p2.submitted,
    },
    actionLog: [],
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
  });

  startFirstSubmitTimer(io, s);
  broadcastState(io, s);

  if (playMode === 'com' && s.firstPlayerId === AI_PLAYER_ID) {
    aiSubmitFirst(io, s);
  }
}

export function handleSilperBnwAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const action = data as SBNWAction;
  const myId = sessions.getToken(socket.id) ?? socket.id;

  switch (action.type) {
    case 'submitFirst': {
      const tiles = sanitizeTiles(action.tiles);
      const result = processFirstSubmit(io, s, myId, tiles);
      if (!result.ok) {
        socket.emit('error', {
          code: 'SBNW_INVALID_SUBMISSION',
          reason: result.reason,
          message: ERROR_MESSAGES[result.reason] ?? '제시가 거부되었습니다.',
        } as never);
      }
      break;
    }
    case 'submitSecond': {
      const tiles = sanitizeTiles(action.tiles);
      const result = processSecondSubmit(io, s, myId, tiles);
      if (!result.ok) {
        socket.emit('error', {
          code: 'SBNW_INVALID_SUBMISSION',
          reason: result.reason,
          message: ERROR_MESSAGES[result.reason] ?? '제시가 거부되었습니다.',
        } as never);
      }
      break;
    }
  }
}

function sanitizeTiles(raw: unknown): SBNWTile[] {
  if (!Array.isArray(raw)) return [];
  const out: SBNWTile[] = [];
  for (const v of raw) {
    if (typeof v !== 'number' || !Number.isInteger(v)) return [];
    if (v < 0 || v > 4) return [];
    out.push(v as SBNWTile);
  }
  return out;
}

export function cleanupSilperBnw(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getSilperBnwState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitSilperBnwStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function canSilperBnwUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s) return false;
  return canSilperBnwUndoState(s);
}

/**
 * 더미용 공개 뷰. 내 타일·점수·상대 장수·선 자릿수만.
 * firstTiles / 상대 tilesUsed·valueStr / dbg 금지.
 */
export function getSilperBnwDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    rematchIndex: s.rematchIndex,
    myId: me.id,
    oppId: opp.id,
    firstPlayerId: s.firstPlayerId,
    my: {
      score: me.score,
      tiles: { ...me.tiles },
      tileCount: me.tileCount,
      submitted: me.submitted,
    },
    opp: {
      score: opp.score,
      tileCount: opp.tileCount,
      submitted: opp.submitted,
    },
    firstDigits: s.phase === 'secondSubmit' ? s.firstDigits : null,
    roundHistory: s.actionLog.map((log) => ({
      round: log.round,
      rematchIndex: log.rematchIndex,
      firstPlayerId: log.firstPlayerId,
      winnerId: log.winnerId,
      players: Object.fromEntries(
        Object.entries(log.players).map(([pid, pd]) => {
          const mine = pid === viewerId;
          return [
            pid,
            {
              digits: pd.digits,
              tilesUsed: mine ? [...pd.tilesUsed] : [],
              valueStr: mine ? pd.valueStr : '',
              scoreBefore: pd.scoreBefore,
              scoreAfter: pd.scoreAfter,
              tileCountBefore: pd.tileCountBefore,
              tileCountAfter: pd.tileCountAfter,
            },
          ];
        }),
      ),
    })),
    winner: s.winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}
