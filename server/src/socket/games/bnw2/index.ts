import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { BNW2Action } from '@shared/types/bnw2.js';
import { calcBNW2Stage, calcBNW2Color } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startFirstSubmitTimer,
  clearRoundTimer,
  processFirstSubmit,
  processSecondSubmit,
  makePlayer,
  getPlayer,
  performBNW2Undo,
  getBNW2ResultData,
  advanceRound,
} from './state.js';
import { aiSubmitFirst, aiSubmitSecond } from './ai.js';

export { performBNW2Undo, getBNW2ResultData };
export type { EndGameFn };

export function initBNW2(
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

  const s = {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'firstSubmit' as const,
    firstPlayerId,
    openingFirstPlayerId: firstPlayerId,
    player1: p1,
    player2: p2,
    firstPoints: null,
    secondPoints: null,
    prevFirstStage: 10,
    winner: null,
    winType: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    roundTimer: null,
    playMode,
    gameOver: false,
    actionLog: [],
    aiGeneration: 0,
    undoSnapshots: [] as [],
  };

  const fullState = s as import('./types.js').InternalState;
  gameStates.set(roomId, fullState);

  if (playMode === 'com') {
    fullState.onAITurn = (io, state) => {
      if (state.phase === 'firstSubmit' && state.firstPlayerId === AI_PLAYER_ID) {
        aiSubmitFirst(io, state);
      } else if (state.phase === 'secondSubmit' && state.firstPlayerId !== AI_PLAYER_ID) {
        aiSubmitSecond(io, state);
      }
    };
  }

  // 첫 스냅샷 저장 후 시작
  fullState.undoSnapshots.push({
    round: fullState.round,
    phase: fullState.phase,
    firstPlayerId: fullState.firstPlayerId,
    firstPoints: null,
    player1: { score: 0, remainingPoints: 200, submitted: false },
    player2: { score: 0, remainingPoints: 200, submitted: false },
    actionLog: [],
  });

  startFirstSubmitTimer(io, fullState);
  broadcastState(io, fullState);

  if (playMode === 'com' && fullState.firstPlayerId === AI_PLAYER_ID) {
    aiSubmitFirst(io, fullState);
  }
}

export function handleBNW2Action(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const action = data as BNW2Action;
  const myId = sessions.getToken(socket.id) ?? socket.id;

  switch (action.type) {
    case 'submitFirst':
      handleSubmitFirst(io, socket, s, myId, action.points);
      break;
    case 'submitSecond':
      handleSubmitSecond(io, socket, s, myId, action.points);
      break;
  }
}

function validatePoints(
  socket: TypedSocket,
  points: unknown,
  remainingPoints: number,
): number | null {
  if (typeof points !== 'number' || !Number.isInteger(points)) {
    socket.emit('error', { message: '유효하지 않은 포인트입니다.' });
    return null;
  }
  if (points < 0 || points > remainingPoints) {
    socket.emit('error', { message: '포인트 범위를 벗어났습니다.' });
    return null;
  }
  return points;
}

function handleSubmitFirst(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  myId: string,
  points: unknown,
) {
  if (s.phase !== 'firstSubmit') {
    socket.emit('error', { message: '선 플레이어 제시 단계가 아닙니다.' });
    return;
  }
  if (myId !== s.firstPlayerId) {
    socket.emit('error', { message: '선 플레이어가 아닙니다.' });
    return;
  }
  const fp = getPlayer(s, myId)!;
  const pts = validatePoints(socket, points, fp.remainingPoints);
  if (pts === null) return;

  clearRoundTimer(s);
  processFirstSubmit(io, s, pts);
}

function handleSubmitSecond(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  myId: string,
  points: unknown,
) {
  if (s.phase !== 'secondSubmit') {
    socket.emit('error', { message: '후 플레이어 제시 단계가 아닙니다.' });
    return;
  }
  if (myId === s.firstPlayerId) {
    socket.emit('error', { message: '후 플레이어가 아닙니다.' });
    return;
  }
  const sp = getPlayer(s, myId)!;
  const pts = validatePoints(socket, points, sp.remainingPoints);
  if (pts === null) return;

  clearRoundTimer(s);
  processSecondSubmit(io, s, pts);
}

export function cleanupBNW2(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getBNW2State(roomId: string) {
  return gameStates.get(roomId);
}

export function emitBNW2StateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function canBNW2Undo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'firstSubmit';
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

/**
 * 더미용 공개 뷰. 내 잔여 숫자·단계·선 색·단계 전후만.
 * firstPoints / 기록 points / dbg 금지.
 */
export function getBnw2DummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    myId: me.id,
    oppId: opp.id,
    firstPlayerId: s.firstPlayerId,
    my: {
      score: me.score,
      remainingPoints: me.remainingPoints,
      stage: calcBNW2Stage(me.remainingPoints),
      submitted: me.submitted,
    },
    opp: {
      score: opp.score,
      stage: calcBNW2Stage(opp.remainingPoints),
      submitted: opp.submitted,
    },
    prevFirstStage: s.phase === 'secondSubmit' ? s.prevFirstStage : null,
    firstPlayerColor:
      s.phase === 'secondSubmit' && s.firstPoints !== null
        ? calcBNW2Color(s.firstPoints)
        : null,
    roundHistory: s.actionLog.map((log) => ({
      round: log.round,
      firstPlayerId: log.firstPlayerId,
      winnerId: log.winnerId,
      players: Object.fromEntries(
        Object.entries(log.players).map(([pid, pd]) => [
          pid,
          {
            color: pd.color,
            scoreChange: pd.scoreChange,
            scoreBefore: pd.scoreBefore,
            scoreAfter: pd.scoreAfter,
            stageBefore: pd.stageBefore,
            stageAfter: pd.stageAfter,
          },
        ]),
      ),
    })),
    winner: s.winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}
