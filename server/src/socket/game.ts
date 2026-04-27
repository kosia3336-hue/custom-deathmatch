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
import {
  initBettingRps,
  handleBettingRpsAction,
  cleanupBettingRps,
  getBettingRpsState,
  emitBettingRpsStateToSocket,
  performBettingRpsUndo,
  canBettingRpsUndo,
} from './games/betting-rps/index.js';
import {
  initMultipleBnw,
  handleMultipleBnwAction,
  cleanupMultipleBnw,
  getMultipleBnwState,
  emitMultipleBnwStateToSocket,
  performMultipleBnwUndo,
  canMultipleBnwUndo,
} from './games/multiple-bnw/index.js';
import {
  initWinningStreak,
  handleWinningStreakAction,
  cleanupWinningStreak,
  getWinningStreakState,
  emitWinningStreakStateToSocket,
  performWinningStreakUndo,
  canWinningStreakUndo,
} from './games/winning-streak/index.js';
import {
  initBNW2,
  handleBNW2Action,
  cleanupBNW2,
  getBNW2State,
  emitBNW2StateToSocket,
  performBNW2Undo,
  canBNW2Undo,
} from './games/bnw2/index.js';
import {
  initSilperBnw,
  handleSilperBnwAction,
  cleanupSilperBnw,
  getSilperBnwState,
  emitSilperBnwStateToSocket,
  performSilperBnwUndo,
  canSilperBnwUndo,
} from './games/silper-bnw/index.js';
import {
  initFiveTowers,
  handleFiveTowersAction,
  cleanupFiveTowers,
  getFiveTowersState,
  emitFiveTowersStateToSocket,
  performFiveTowersUndo,
  canFiveTowersUndo,
} from './games/five-towers/index.js';
import {
  initGrapeSugar2,
  handleGrapeSugar2Action,
  cleanupGrapeSugar2,
  getGrapeSugar2State,
  emitGrapeSugar2StateToSocket,
  performGS2Undo,
  canGrapeSugar2Undo,
} from './games/grape-sugar-2/index.js';
import {
  initSunMoonStar2,
  handleSunMoonStar2Action,
  cleanupSunMoonStar2,
  getSunMoonStar2State,
  emitSunMoonStar2StateToSocket,
  performSunMoonStar2Undo,
  canSunMoonStar2Undo,
} from './games/sun-moon-star-2/index.js';
import {
  initBankGame,
  handleBankGameAction,
  cleanupBankGame,
  getBankGameState,
  emitBankGameStateToSocket,
  performBankGameUndo,
  canBankGameUndo,
} from './games/bank-game/index.js';

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
  [GAME_IDS.BETTING_RPS]: {
    init: initBettingRps,
    handleAction: handleBettingRpsAction,
    cleanup: cleanupBettingRps,
    getState: (roomId) => {
      const s = getBettingRpsState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitBettingRpsStateToSocket,
    performUndo: performBettingRpsUndo,
    canUndo: canBettingRpsUndo,
  },
  [GAME_IDS.MULTIPLE_BNW]: {
    init: initMultipleBnw,
    handleAction: handleMultipleBnwAction,
    cleanup: cleanupMultipleBnw,
    getState: (roomId) => {
      const s = getMultipleBnwState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitMultipleBnwStateToSocket,
    performUndo: performMultipleBnwUndo,
    canUndo: canMultipleBnwUndo,
  },
  [GAME_IDS.WINNING_STREAK]: {
    init: initWinningStreak,
    handleAction: handleWinningStreakAction,
    cleanup: cleanupWinningStreak,
    getState: (roomId) => {
      const s = getWinningStreakState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitWinningStreakStateToSocket,
    performUndo: performWinningStreakUndo,
    canUndo: canWinningStreakUndo,
  },
  [GAME_IDS.BNW2]: {
    init: initBNW2,
    handleAction: handleBNW2Action,
    cleanup: cleanupBNW2,
    getState: (roomId) => {
      const s = getBNW2State(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitBNW2StateToSocket,
    performUndo: performBNW2Undo,
    canUndo: canBNW2Undo,
  },
  [GAME_IDS.SILPER_BNW]: {
    init: initSilperBnw,
    handleAction: handleSilperBnwAction,
    cleanup: cleanupSilperBnw,
    getState: (roomId) => {
      const s = getSilperBnwState(roomId);
      if (!s) return undefined;
      const totalRounds = s.segmentsHistory.reduce((sum, seg) => sum + seg.rounds.length, 0) + s.actionLog.length;
      return { gameOver: s.gameOver, totalTurns: totalRounds };
    },
    emitStateToSocket: emitSilperBnwStateToSocket,
    performUndo: performSilperBnwUndo,
    canUndo: canSilperBnwUndo,
  },
  [GAME_IDS.FIVE_TOWERS]: {
    init: initFiveTowers,
    handleAction: handleFiveTowersAction,
    cleanup: cleanupFiveTowers,
    getState: (roomId) => {
      const s = getFiveTowersState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.turn } : undefined;
    },
    emitStateToSocket: emitFiveTowersStateToSocket,
    performUndo: performFiveTowersUndo,
    canUndo: canFiveTowersUndo,
  },
  [GAME_IDS.GRAPE_SUGAR_2]: {
    init: initGrapeSugar2,
    handleAction: handleGrapeSugar2Action,
    cleanup: cleanupGrapeSugar2,
    getState: (roomId) => {
      const s = getGrapeSugar2State(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
    },
    emitStateToSocket: emitGrapeSugar2StateToSocket,
    performUndo: performGS2Undo,
    canUndo: canGrapeSugar2Undo,
  },
  [GAME_IDS.SUN_MOON_STAR_2]: {
    init: initSunMoonStar2,
    handleAction: handleSunMoonStar2Action,
    cleanup: cleanupSunMoonStar2,
    getState: (roomId) => {
      const s = getSunMoonStar2State(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
    },
    emitStateToSocket: emitSunMoonStar2StateToSocket,
    performUndo: performSunMoonStar2Undo,
    canUndo: canSunMoonStar2Undo,
  },
  [GAME_IDS.BANK_GAME]: {
    init: initBankGame,
    handleAction: handleBankGameAction,
    cleanup: cleanupBankGame,
    getState: (roomId) => {
      const s = getBankGameState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
    },
    emitStateToSocket: emitBankGameStateToSocket,
    performUndo: performBankGameUndo,
    canUndo: canBankGameUndo,
  },
};

const autoEndTimers = new Map<string, NodeJS.Timeout>();
const gameStartTimes = new Map<string, number>();

/** 소켓의 Player.id (= localStorage 토큰)를 반환. 토큰 없으면 socket.id를 폴백으로 사용 */
function getPlayerId(socket: TypedSocket): string {
  return sessions.getToken(socket.id) ?? socket.id;
}

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

/** 게임 진행 중 플레이어가 나갈 때 멀티 포기 처리. playerId = Player.id(token) */
export function handleGameForfeit(io: IO, roomId: string, playerId: string) {
  const room = roomStore.get(roomId);
  if (!room || room.status !== 'playing') return;

  const isPlayer = room.players.some((p: Player) => p.id === playerId);
  if (!isPlayer) return;

  const gameModule = gameModules[room.gameId];
  if (!gameModule) return;

  const state = gameModule.getState(roomId);
  clearPendingUndo(roomId);
  gameModule.cleanup(roomId);

  if (state && !state.gameOver && room.playMode === 'multi') {
    const other = room.players.find((p: Player) => p.id !== playerId);
    const leaverNickname =
      room.players.find((p: Player) => p.id === playerId)?.nickname ??
      sessions.getNicknameByToken(playerId) ??
      '???';
    if (other) {
      endGame(io, roomId, {
        rankings: [
          { playerId: other.id, nickname: other.nickname, rank: 1, score: 1 },
          { playerId, nickname: leaverNickname, rank: 2, score: 0 },
        ],
        totalTurns: state.totalTurns,
      });
    }
  }
}

/** session:restore 시 index.ts에서 game:state를 재전송하는 데 사용 */
export function emitGameStateToSocket(socket: TypedSocket, roomId: string, gameId: string) {
  gameModules[gameId]?.emitStateToSocket(socket, roomId);
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

    const myId = getPlayerId(socket);

    if (!room.players.some((p: Player) => p.id === myId)) {
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
      const opponent = room.players.find((p: Player) => p.id !== myId);
      if (!opponent) return;
      const requestId = randomUUID();
      setPendingUndo(roomId, {
        requestId,
        requesterId: myId,
        gameId: room.gameId,
      });
      // opponent.id = token → 실제 소켓으로 라우팅
      const opponentSocketId = sessions.getSocketByToken(opponent.id) ?? opponent.id;
      io.to(opponentSocketId).emit('game:undo:proposal', {
        requestId,
        requesterId: myId,
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

    const myId = getPlayerId(socket);
    const pending = peekPendingUndo(roomId);
    if (!pending || pending.requestId !== requestId) return;
    if (myId === pending.requesterId) return;

    const isOpponent = room.players.some(
      (p: Player) => p.id === myId && p.id !== pending.requesterId,
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

    const myId = getPlayerId(socket);
    const pending = peekPendingUndo(roomId);
    if (!pending || pending.requestId !== requestId) return;
    if (myId === pending.requesterId) return;

    const isOpponent = room.players.some(
      (p: Player) => p.id === myId && p.id !== pending.requesterId,
    );
    if (!isOpponent) return;

    clearPendingUndo(roomId);
    // pending.requesterId = token → 실제 소켓으로 라우팅
    const requesterSocketId = sessions.getSocketByToken(pending.requesterId) ?? pending.requesterId;
    io.to(requesterSocketId).emit('game:undo:declined');
  });

  socket.on('game:end', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId) return;

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
      // p.id = token → 소켓 ID를 역조회해서 clearRoom
      r.players.forEach((p: Player) => {
        const sid = sessions.getSocketByToken(p.id) ?? p.id;
        sessions.clearRoom(sid);
      });
      r.spectators.forEach((p: Player) => {
        const sid = sessions.getSocketByToken(p.id) ?? p.id;
        sessions.clearRoom(sid);
      });
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
