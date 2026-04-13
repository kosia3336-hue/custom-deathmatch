import { randomUUID } from 'node:crypto';
import type { GameState, GameResult } from '@shared/types/events.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { broadcastRoomUpdated, broadcastRoomRemoved } from './lobby.js';
import { clearRoomStartCountdown } from './roomCountdown.js';
import config from '../config.js';
import { socketRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import {
  clearPendingUndo,
  peekPendingUndo,
  setPendingUndo,
  takePendingUndo,
} from './gameUndoPending.js';
import {
  initFourGravity,
  handleFourGravityAction,
  cleanupFourGravity,
  getFourGravityState,
  emitFourGravityStateToSocket,
  performFourGravityUndo,
  canFourGravityUndo,
} from './games/four-gravity/index.js';
import {
  initDoubleSidedChess,
  handleDoubleSidedChessAction,
  cleanupDoubleSidedChess,
  getDoubleSidedChessState,
  emitDoubleSidedChessStateToSocket,
  performDoubleSidedChessUndo,
  canDoubleSidedChessUndo,
} from './games/double-sided-chess/index.js';
import {
  initNumberFour,
  handleNumberFourAction,
  cleanupNumberFour,
  getNumberFourState,
  emitNumberFourStateToSocket,
  performNumberFourUndo,
  canNumberFourUndo,
} from './games/number4/index.js';
import {
  initIndianPoker,
  handleIndianPokerAction,
  cleanupIndianPoker,
  getIndianPokerState,
  emitIndianPokerStateToSocket,
  performIndianPokerUndo,
  canIndianPokerUndo,
} from './games/indian-poker/index.js';
import {
  initInvestDonate,
  handleInvestDonateAction,
  cleanupInvestDonate,
  getInvestDonateState,
  emitInvestDonateStateToSocket,
  performInvestDonateUndo,
  canInvestDonateUndo,
} from './games/invest-donate/index.js';

type EndGameCallback = (
  io: IO,
  roomId: string,
  data: { rankings?: GameResult['rankings']; totalTurns?: number; gameResultData?: unknown },
) => void;

interface GameModuleHandlers {
  init: (
    io: IO, roomId: string, players: Player[], playMode: PlayMode,
    startedAt: number, timeLimitSeconds: number | null,
    endGameCallback: EndGameCallback,
    gameOptions?: Record<string, unknown>,
  ) => void;
  handleAction: (io: IO, socket: TypedSocket, roomId: string, data: Record<string, unknown>) => void;
  cleanup: (roomId: string) => void;
  getState: (roomId: string) => { gameOver: boolean; totalTurns: number } | undefined;
  emitStateToSocket: (socket: TypedSocket, roomId: string) => void;
  performUndo: (io: IO, roomId: string) => boolean;
  canUndo: (roomId: string) => boolean;
}

const gameModules: Record<string, GameModuleHandlers> = {
  [GAME_IDS.FOUR_GRAVITY]: {
    init: initFourGravity,
    handleAction: handleFourGravityAction,
    cleanup: cleanupFourGravity,
    getState: (roomId) => {
      const s = getFourGravityState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.turnNumber } : undefined;
    },
    emitStateToSocket: emitFourGravityStateToSocket,
    performUndo: performFourGravityUndo,
    canUndo: canFourGravityUndo,
  },
  [GAME_IDS.DOUBLE_SIDED_CHESS]: {
    init: initDoubleSidedChess,
    handleAction: handleDoubleSidedChessAction,
    cleanup: cleanupDoubleSidedChess,
    getState: (roomId) => {
      const s = getDoubleSidedChessState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.turnNumber } : undefined;
    },
    emitStateToSocket: emitDoubleSidedChessStateToSocket,
    performUndo: performDoubleSidedChessUndo,
    canUndo: canDoubleSidedChessUndo,
  },
  [GAME_IDS.NUMBER_FOUR]: {
    init: initNumberFour,
    handleAction: handleNumberFourAction,
    cleanup: cleanupNumberFour,
    getState: (roomId) => {
      const s = getNumberFourState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitNumberFourStateToSocket,
    performUndo: performNumberFourUndo,
    canUndo: canNumberFourUndo,
  },
  [GAME_IDS.INDIAN_POKER]: {
    init: initIndianPoker,
    handleAction: handleIndianPokerAction,
    cleanup: cleanupIndianPoker,
    getState: (roomId) => {
      const s = getIndianPokerState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.totalBettingActions } : undefined;
    },
    emitStateToSocket: emitIndianPokerStateToSocket,
    performUndo: performIndianPokerUndo,
    canUndo: canIndianPokerUndo,
  },
  [GAME_IDS.INVEST_DONATE]: {
    init: initInvestDonate,
    handleAction: handleInvestDonateAction,
    cleanup: cleanupInvestDonate,
    getState: (roomId) => {
      const s = getInvestDonateState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitInvestDonateStateToSocket,
    performUndo: performInvestDonateUndo,
    canUndo: canInvestDonateUndo,
  },
};

const autoEndTimers = new Map<string, NodeJS.Timeout>();

// 게임 실제 시작 시각 추적 (방 생성 시각이 아닌 게임 시작 시각으로 플레이 시간 계산)
const gameStartTimes = new Map<string, number>();

export function startGame(io: IO, roomId: string) {
  const room = roomStore.get(roomId);
  if (!room) return;

  clearPendingUndo(roomId);

  const startedAt = Date.now();
  gameStartTimes.set(roomId, startedAt);

  roomStore.setStatus(roomId, 'playing');

  const clientRoom = roomStore.getClientRoom(roomId);
  if (clientRoom) io.to(socketRoom(roomId)).emit('room:state', clientRoom);

  io.to(socketRoom(roomId)).emit('room:game:started');

  const gameModule = gameModules[room.gameId];
  if (gameModule) {
    try {
      gameModule.init(io, roomId, room.players, room.playMode, startedAt, room.timeLimitSeconds, (cbIo, cbRoomId, data) => {
        endGame(cbIo, cbRoomId, data);
      }, room.gameOptions);
    } catch (err) {
      console.error('[startGame] 게임 초기화 예외', { roomId, gameId: room.gameId }, err);
      io.to(socketRoom(roomId)).emit('room:disbanded', { reason: '게임을 시작하는 중 오류가 발생했습니다.' });
      roomStore.delete(roomId);
      broadcastRoomRemoved(io, roomId);
      return;
    }
  } else {
    const state: GameState = {
      roomId,
      message: '게임이 시작되었습니다! (게임 모듈 플레이스홀더)',
      currentTurn: room.players[0]?.id ?? null,
      turnNumber: 1,
      startedAt,
      turnStartedAt: null,
    };
    io.to(socketRoom(roomId)).emit('game:state', state);
  }
  broadcastRoomUpdated(io, roomId);
}

/** 게임 진행 중 플레이어가 나갈 때 멀티 포기 처리 후 cleanup. 이미 종료된 게임이면 아무 것도 하지 않음. */
export function handleGameForfeit(io: IO, roomId: string, leavingSocketId: string) {
  const room = roomStore.get(roomId);
  if (!room || room.status !== 'playing') return;

  const isPlayer = room.players.some((p: Player) => p.id === leavingSocketId);
  if (!isPlayer) return;

  const gameModule = gameModules[room.gameId];
  if (!gameModule) return;

  const state = gameModule.getState(roomId);
  clearPendingUndo(roomId);
  gameModule.cleanup(roomId);

  if (state && !state.gameOver && room.playMode === 'multi') {
    const other = room.players.find((p: Player) => p.id !== leavingSocketId);
    if (other) {
      endGame(io, roomId, {
        rankings: [
          { playerId: other.id, nickname: other.nickname, rank: 1, score: 1 },
          { playerId: leavingSocketId, nickname: sessions.getNickname(leavingSocketId) ?? '???', rank: 2, score: 0 },
        ],
        totalTurns: state.totalTurns,
      });
    }
  }
}

export function registerGameHandlers(io: IO, socket: TypedSocket) {
  socket.on('game:sync', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    const clientRoom = roomStore.getClientRoom(roomId);
    if (clientRoom) socket.emit('room:state', clientRoom);

    gameModules[room.gameId]?.emitStateToSocket(socket, roomId);
  });

  socket.on('game:action', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    gameModules[room.gameId]?.handleAction(io, socket, roomId, data);
  });

  socket.on('game:undo:request', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    if (!room.players.some((p: Player) => p.id === socket.id)) {
      socket.emit('error', { message: '플레이어만 무르기를 요청할 수 있습니다.' });
      return;
    }

    if (peekPendingUndo(roomId)) {
      socket.emit('error', { message: '이미 처리 중인 무르기 요청이 있습니다.' });
      return;
    }

    const gameModule = gameModules[room.gameId];
    if (!gameModule?.canUndo(roomId)) {
      socket.emit('error', { message: '지금은 무르기를 요청할 수 없습니다.' });
      return;
    }

    if (room.playMode === 'multi') {
      const opponent = room.players.find((p: Player) => p.id !== socket.id);
      if (!opponent) return;
      const requestId = randomUUID();
      setPendingUndo(roomId, {
        requestId,
        requesterId: socket.id,
        gameId: room.gameId,
      });
      io.to(opponent.id).emit('game:undo:proposal', {
        requestId,
        requesterId: socket.id,
        requesterNickname: sessions.getNickname(socket.id) ?? '플레이어',
      });
      return;
    }

    const ok = gameModule.performUndo(io, roomId);
    if (!ok) {
      socket.emit('error', { message: '지금은 무를 수 있는 수가 없습니다.' });
    }
  });

  socket.on('game:undo:accept', (data) => {
    const requestId = data?.requestId;
    if (typeof requestId !== 'string') return;
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    const pending = peekPendingUndo(roomId);
    if (!pending || pending.requestId !== requestId) return;
    if (socket.id === pending.requesterId) return;

    const isOpponent = room.players.some(
      (p: Player) => p.id === socket.id && p.id !== pending.requesterId,
    );
    if (!isOpponent) return;

    takePendingUndo(roomId, requestId);

    const ok = gameModules[room.gameId]?.performUndo(io, roomId) ?? false;
    if (!ok) {
      socket.emit('error', { message: '무르기에 실패했습니다.' });
    }
  });

  socket.on('game:undo:decline', (data) => {
    const requestId = data?.requestId;
    if (typeof requestId !== 'string') return;
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    const pending = peekPendingUndo(roomId);
    if (!pending || pending.requestId !== requestId) return;
    if (socket.id === pending.requesterId) return;

    const isOpponent = room.players.some(
      (p: Player) => p.id === socket.id && p.id !== pending.requesterId,
    );
    if (!isOpponent) return;

    clearPendingUndo(roomId);
    io.to(pending.requesterId).emit('game:undo:declined');
  });

  socket.on('game:end', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    clearPendingUndo(roomId);
    gameModules[room.gameId]?.cleanup(roomId);
    endGame(io, roomId);
  });

  socket.on('game:rematch', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;

    clearAutoEnd(roomId);

    if (room.playMode === 'multi') {
      roomStore.resetForRematch(roomId);
      const clientRoom = roomStore.getClientRoom(roomId);
      if (clientRoom) io.to(socketRoom(roomId)).emit('room:state', clientRoom);
      broadcastRoomUpdated(io, roomId);
    } else {
      startGame(io, roomId);
    }
  });

}

export function endGame(
  io: IO,
  roomId: string,
  data?: { rankings?: GameResult['rankings']; totalTurns?: number; gameResultData?: unknown },
) {
  const room = roomStore.get(roomId);
  if (!room) return;

  // 이중 호출 시 기존 타이머를 먼저 정리
  clearAutoEnd(roomId);

  roomStore.setStatus(roomId, 'finished');

  const startedAt = gameStartTimes.get(roomId) ?? room.createdAt;
  const playTime = Date.now() - startedAt;
  gameStartTimes.delete(roomId);

  const result: GameResult = {
    roomId,
    rankings: data?.rankings ?? room.players.map((p: Player, i: number) => ({
      playerId: p.id,
      nickname: p.nickname,
      rank: i + 1,
      score: 0,
    })),
    playTime,
    totalTurns: data?.totalTurns ?? 0,
    ...(data?.gameResultData != null && { gameResultData: data.gameResultData }),
  };

  io.to(socketRoom(roomId)).emit('game:ended', result);
  broadcastRoomUpdated(io, roomId);

  const timer = setTimeout(() => {
    const r = roomStore.get(roomId);
    if (r && r.status === 'finished') {
      io.to(socketRoom(roomId)).emit('room:disbanded', { reason: '시간 초과로 방이 종료되었습니다.' });
      r.players.forEach((p: Player) => sessions.clearRoom(p.id));
      r.spectators.forEach((p: Player) => sessions.clearRoom(p.id));
      clearRoomStartCountdown(roomId);
      sessions.clearRoomFromAllKicks(roomId);
      roomStore.delete(roomId);
      broadcastRoomRemoved(io, roomId);
    }
    autoEndTimers.delete(roomId);
  }, config.roomAutoDestroyDelay);

  autoEndTimers.set(roomId, timer);
}

export function clearAutoEnd(roomId: string) {
  const timer = autoEndTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    autoEndTimers.delete(roomId);
  }
}

export function clearGameStartTime(roomId: string) {
  gameStartTimes.delete(roomId);
}
