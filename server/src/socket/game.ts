import { randomUUID } from 'node:crypto';
import type { GameState, GameResult } from '@shared/types/events.js';
import type { Player, PlayMode, Room } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { broadcastRoomUpdated, broadcastRoomRemoved } from './lobby.js';
import { clearRoomStartCountdown } from './roomCountdown.js';
import config from '../config.js';
import { socketRoom, maskedClientRoomForSocket, emitRoomStateToRoom } from './utils.js';
import { getRoomShopState, cleanupRoomShopState } from '../shop/roomShopState.js';
import { maskRankingForViewer } from '../shop/maskNicknames.js';
import type { IO, TypedSocket } from './types.js';
import { finalizeRankedMultiGameEnd } from '../rank/processRankedGameEnd.js';
import { persistGameEndLog } from './gameEndPersistence.js';
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
  handleFourGravityToggleAI,
  getFourGravityResultData,
} from './games/four-gravity/index.js';
import {
  initDoubleSidedChess,
  handleDoubleSidedChessAction,
  cleanupDoubleSidedChess,
  getDoubleSidedChessState,
  emitDoubleSidedChessStateToSocket,
  performDoubleSidedChessUndo,
  canDoubleSidedChessUndo,
  handleDoubleSidedChessToggleAI,
  getDoubleSidedChessResultData,
} from './games/double-sided-chess/index.js';
import {
  initNumberFour,
  handleNumberFourAction,
  cleanupNumberFour,
  getNumberFourState,
  emitNumberFourStateToSocket,
  performNumberFourUndo,
  canNumberFourUndo,
  getNumberFourResultData,
} from './games/number4/index.js';
import {
  initIndianPoker,
  handleIndianPokerAction,
  cleanupIndianPoker,
  getIndianPokerState,
  emitIndianPokerStateToSocket,
  performIndianPokerUndo,
  canIndianPokerUndo,
  getIndianPokerResultData,
} from './games/indian-poker/index.js';
import {
  initInvestDonate,
  handleInvestDonateAction,
  cleanupInvestDonate,
  getInvestDonateState,
  emitInvestDonateStateToSocket,
  performInvestDonateUndo,
  canInvestDonateUndo,
  getInvestDonateResultData,
} from './games/invest-donate/index.js';
import {
  initBettingRps,
  handleBettingRpsAction,
  cleanupBettingRps,
  getBettingRpsState,
  emitBettingRpsStateToSocket,
  performBettingRpsUndo,
  canBettingRpsUndo,
  getBettingRpsResultData,
} from './games/betting-rps/index.js';
import {
  initMultipleBnw,
  handleMultipleBnwAction,
  cleanupMultipleBnw,
  getMultipleBnwState,
  emitMultipleBnwStateToSocket,
  performMultipleBnwUndo,
  canMultipleBnwUndo,
  getMultipleBnwResultData,
} from './games/multiple-bnw/index.js';
import {
  initWinningStreak,
  handleWinningStreakAction,
  cleanupWinningStreak,
  getWinningStreakState,
  emitWinningStreakStateToSocket,
  performWinningStreakUndo,
  canWinningStreakUndo,
  getWinningStreakResultData,
} from './games/winning-streak/index.js';
import {
  initBNW2,
  handleBNW2Action,
  cleanupBNW2,
  getBNW2State,
  emitBNW2StateToSocket,
  performBNW2Undo,
  canBNW2Undo,
  getBNW2ResultData,
} from './games/bnw2/index.js';
import {
  initSilperBnw,
  handleSilperBnwAction,
  cleanupSilperBnw,
  getSilperBnwState,
  emitSilperBnwStateToSocket,
  performSilperBnwUndo,
  canSilperBnwUndo,
  getSilperBnwResultData,
} from './games/silper-bnw/index.js';
import {
  initFiveTowers,
  handleFiveTowersAction,
  cleanupFiveTowers,
  getFiveTowersState,
  emitFiveTowersStateToSocket,
  performFiveTowersUndo,
  canFiveTowersUndo,
  getFiveTowersResultData,
} from './games/five-towers/index.js';
import {
  initGrapeSugar2,
  handleGrapeSugar2Action,
  cleanupGrapeSugar2,
  getGrapeSugar2State,
  emitGrapeSugar2StateToSocket,
  performGS2Undo,
  canGrapeSugar2Undo,
  getGrapeSugar2ResultData,
} from './games/grape-sugar-2/index.js';
import {
  initSunMoonStar2,
  handleSunMoonStar2Action,
  cleanupSunMoonStar2,
  getSunMoonStar2State,
  emitSunMoonStar2StateToSocket,
  performSunMoonStar2Undo,
  canSunMoonStar2Undo,
  getSunMoonStar2ResultData,
} from './games/sun-moon-star-2/index.js';
import {
  initBankGame,
  handleBankGameAction,
  cleanupBankGame,
  getBankGameState,
  emitBankGameStateToSocket,
  performBankGameUndo,
  canBankGameUndo,
  getBankGameResultData,
} from './games/bank-game/index.js';
import {
  initBanPick,
  handleBanPickBan,
  handleBanPickNoBan,
  handleBanPickReady,
  handleBanPickUnban,
  handleBanPickUnbanSkip,
  cleanupBanPick,
  getBanPickState,
  emitBanPickStateToSocket,
  canBanPickUndo,
  performBanPickUndo,
} from './games/ban-pick/index.js';
import { saveRankBanPickLog } from '../db/rankBanLog.js';

function launchPickedGame(
  io: IO,
  roomId: string,
  pickedGameId: string,
  pickedGameName: string,
  players: Player[],
  playMode: PlayMode,
  endGameCallback: EndGameCallback,
) {
  const room = roomStore.get(roomId);
  if (!room) return;

  roomStore.setGameId(roomId, pickedGameId, pickedGameName);
  roomStore.markFromBanPick(roomId);

  // Initialise the real game first so game:state arrives before room:state
  const gameModule = gameModules[pickedGameId];
  if (gameModule) {
    gameModule.init(io, roomId, players, playMode, Date.now(), room.timeLimitSeconds, endGameCallback, {});
  }

  emitRoomStateToRoom(io, roomId);
}

type EndGameCallback = (
  io: IO,
  roomId: string,
  data: {
    rankings?: GameResult['rankings'];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
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
  getResultData?: (roomId: string) => unknown;
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
    getResultData: getFourGravityResultData,
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
    getResultData: getDoubleSidedChessResultData,
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
    getResultData: getNumberFourResultData,
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
    getResultData: getIndianPokerResultData,
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
    getResultData: getInvestDonateResultData,
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
    getResultData: getBettingRpsResultData,
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
    getResultData: getMultipleBnwResultData,
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
    getResultData: getWinningStreakResultData,
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
    getResultData: getBNW2ResultData,
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
    getResultData: getSilperBnwResultData,
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
    getResultData: getFiveTowersResultData,
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
    getResultData: getGrapeSugar2ResultData,
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
    getResultData: getSunMoonStar2ResultData,
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
    getResultData: getBankGameResultData,
  },
  [GAME_IDS.BAN_PICK]: {
    init: (io, roomId, players, playMode, startedAt, timeLimitSeconds, endGameCallback, gameOptions) => {
      void initBanPick(io, roomId, players, playMode, startedAt, timeLimitSeconds, endGameCallback, gameOptions,
        (pickedGameId, pickedGameName) => {
          launchPickedGame(io, roomId, pickedGameId, pickedGameName, players, playMode, endGameCallback);
        },
        (banData) => {
          const room = roomStore.get(roomId);
          if (!room?.isRanked || room.rankSeasonId == null) return;
          const firstPlayer = players[0];
          const secondPlayer = players[1];
          saveRankBanPickLog({
            seasonId: room.rankSeasonId,
            firstMemberId: firstPlayer?.memberId ?? null,
            secondMemberId: secondPlayer?.memberId ?? null,
            pickedGameId: banData.pickedGameId,
            bannedGames: banData.bannedGames,
          }).catch((err) => {
            console.warn('[rankBanLog] 저장 실패:', (err as Error).message);
          });
        },
      );
    },
    handleAction: () => {},
    cleanup: cleanupBanPick,
    getState: getBanPickState,
    emitStateToSocket: emitBanPickStateToSocket,
    performUndo: performBanPickUndo,
    canUndo: canBanPickUndo,
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

  emitRoomStateToRoom(io, roomId);

  io.to(socketRoom(roomId)).emit('room:game:started');

  const gameModule = gameModules[room.gameId];
  if (gameModule) {
    try {
      // random 모드이면 50% 확률로 플레이어 순서 뒤집기
      const playersForGame =
        room.turnOrderMode === 'random' && room.players.length === 2 && Math.random() < 0.5
          ? [room.players[1], room.players[0]]
          : room.players;
      gameModule.init(io, roomId, playersForGame, room.playMode, startedAt, room.timeLimitSeconds, (cbIo, cbRoomId, data) => {
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
  const gameResultData = gameModule.getResultData?.(roomId);
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
        endedByForfeit: true,
        gameResultData,
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

    const clientRoom = maskedClientRoomForSocket(roomId, socket);
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
    if (!room) return;

    const myId = getPlayerId(socket);

    const isSpecialPostGame =
      room.status === 'finished' &&
      (room.gameId === 'game-001' || room.gameId === 'game-002') &&
      room.playMode === 'solo' &&
      room.players.some((p: Player) => p.nickname === '천하');

    if (!isSpecialPostGame && room.status !== 'playing') return;

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
    if (ok && isSpecialPostGame) {
      clearAutoEnd(roomId);
      roomStore.setStatus(roomId, 'playing');
      const clientRoom = roomStore.getClientRoom(roomId);
      if (clientRoom) io.to(socketRoom(roomId)).emit('room:state', clientRoom);
    }
    if (!ok) {
      socket.emit('error', { message: '지금은 무를 수 있는 수가 없습니다.' });
    }
  });

  socket.on('banpick:ban', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleBanPickBan(io, socket, roomId, data.gameId);
  });

  socket.on('banpick:noban', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleBanPickNoBan(io, socket, roomId);
  });

  socket.on('banpick:ready', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleBanPickReady(io, roomId, getPlayerId(socket));
  });

  socket.on('banpick:unban', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    const gameId = typeof data?.gameId === 'string' ? data.gameId : null;
    if (!gameId) return;
    handleBanPickUnban(io, socket, roomId, gameId);
  });

  socket.on('banpick:unban_skip', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleBanPickUnbanSkip(socket, roomId, io);
  });

  socket.on('game:four-gravity:toggle-ai', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleFourGravityToggleAI(io, socket, roomId, data as Record<string, unknown>);
  });

  socket.on('game:double-sided-chess:toggle-ai', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleDoubleSidedChessToggleAI(io, socket, roomId, data as Record<string, unknown>);
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

  socket.on('game:resign', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing' || !room.isRanked) return;
    const myId = getPlayerId(socket);
    if (!room.players.some((p: Player) => p.id === myId)) return;
    // forfeit 처리(game:ended 방송)만 하고 소켓 방은 유지 — 결과화면을 보여주기 위함
    handleGameForfeit(io, roomId, myId);
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
  data?: {
    rankings?: GameResult['rankings'];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) {
  const room = roomStore.get(roomId);
  if (!room) return;

  clearAutoEnd(roomId);

  roomStore.setStatus(roomId, 'finished');

  const startedAt = gameStartTimes.get(roomId) ?? room.createdAt;
  const playTime = Date.now() - startedAt;
  gameStartTimes.delete(roomId);

  const baseRankings = data?.rankings ?? room.players.map((p: Player, i: number) => ({
    playerId: p.id,
    nickname: p.nickname,
    rank: i + 1,
    score: 0,
  }));
  const result: GameResult = {
    roomId,
    rankings: baseRankings.map((r) => ({
      ...r,
      memberId: room.players.find((p: Player) => p.id === r.playerId)?.memberId ?? null,
    })),
    playTime,
    totalTurns: data?.totalTurns ?? 0,
    ...(data?.gameResultData != null && { gameResultData: data.gameResultData }),
    ...(data?.endedByForfeit === true && { endedByForfeit: true }),
  };

  const emitEndedAndGrants = (payload: GameResult) => {
    const shopState = getRoomShopState(roomId);
    if (shopState && shopState.anonymizedTokens.size > 0) {
      // viewer 시점별 마스킹: 본인은 원본, 다른 사람은 닉네임 ??? 처리
      const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
      if (sockets) {
        for (const sid of sockets) {
          const viewerToken = sessions.getToken(sid) ?? null;
          const masked: GameResult = {
            ...payload,
            rankings: maskRankingForViewer(roomId, payload.rankings, viewerToken),
          };
          io.sockets.sockets.get(sid)?.emit('game:ended', masked);
        }
      } else {
        io.to(socketRoom(roomId)).emit('game:ended', payload);
      }
    } else {
      io.to(socketRoom(roomId)).emit('game:ended', payload);
    }

    broadcastRoomUpdated(io, roomId);
    for (const player of room.players) {
      if (player.id === AI_PLAYER_ID) continue;
      if (!sessions.hasPendingTitles(player.id)) continue;
      const sid = sessions.getSocketByToken(player.id);
      if (!sid) continue;
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;
      for (const notif of sessions.takePendingTitles(player.id)) {
        sock.emit('title:granted', notif);
      }
    }
  };

  const shouldRankFinalize =
    room.isRanked === true
    && room.rankSeasonId != null
    && room.playMode === 'multi'
    && room.players.filter((p: Player) => p.memberId && p.id !== AI_PLAYER_ID).length === 2;

  console.log(`[endGame] roomId=${roomId} gameId=${room.gameId} isRanked=${room.isRanked} seasonId=${room.rankSeasonId} playMode=${room.playMode} memberedPlayers=${room.players.filter((p: Player) => p.memberId && p.id !== AI_PLAYER_ID).length} shouldRankFinalize=${shouldRankFinalize}`);

  if (shouldRankFinalize) {
    const roomSnapshot = { ...room, players: [...room.players] };
    void finalizeRankedMultiGameEnd(io, roomSnapshot, result)
      .then((final) => emitEndedAndGrants(final))
      .catch((err) => {
        console.warn('[rank] finalizeRankedMultiGameEnd 실패:', (err as Error).message);
        emitEndedAndGrants(result);
        // Phase 1 실패 시에도 게임 로그는 저장 시도
        recordGameEndAsync(io, room, result).catch((e) => {
          console.warn('[rank:fallback] 게임로그 저장 실패:', (e as Error).message);
        });
      });
  } else {
    emitEndedAndGrants(result);
    recordGameEndAsync(io, room, result).catch((err) => {
      console.warn('[game:ended] record_game_end 실패:', (err as Error).message);
    });
  }

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
      cleanupRoomShopState(roomId);
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

async function recordGameEndAsync(io: IO, room: Room, result: GameResult): Promise<void> {
  try {
    await persistGameEndLog(io, room, result);
  } catch (err) {
    console.warn('[game:ended] record_game_end 실패:', (err as Error).message);
  }
}
