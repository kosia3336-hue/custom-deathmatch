import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { WSCardType } from '@shared/types/winning-streak.js';
import { WS_INITIAL_CARDS, CARD_TYPES } from '@shared/types/winning-streak.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, WSPlayerInternal } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startRoundWithSnapshot,
  clearRoundTimer,
  trySubmitCard,
  resetTimeout,
  performWinningStreakUndo,
} from './state.js';
import { handleAiTurn } from './ai.js';

export type { EndGameFn };
export { performWinningStreakUndo };

export function initWinningStreak(
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

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'cardSelect',
    player1: p1,
    player2: p2,
    roundHistory: [],
    actionLog: [],
    winner: null,
    winType: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    roundTimer: null,
    playMode,
    gameOver: false,
    aiGeneration: 0,
    undoSnapshots: [],
    consecutiveTimeouts: { [p1.id]: 0, [p2.id]: 0 },
  });

  const s = gameStates.get(roomId)!;

  if (playMode === 'com') {
    s.onAITurn = (cbIo, cbState) => handleAiTurn(cbIo, cbState);
  }

  startRoundWithSnapshot(io, s);
  broadcastState(io, s);

  if (playMode === 'com') {
    handleAiTurn(io, s);
  }
}

function makePlayer(id: string, nickname: string): WSPlayerInternal {
  return {
    id,
    nickname,
    currentStreak: 0,
    maxStreak: 0,
    totalWins: 0,
    remainingCards: { ...WS_INITIAL_CARDS },
    lastPlayedCard: null,
    selectedCard: null,
    submitted: false,
  };
}

export function handleWinningStreakAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;

  if (data.type !== 'selectCard') return;

  if (s.phase !== 'cardSelect') {
    socket.emit('error', { message: '현재 단계에서는 카드를 선택할 수 없습니다.' });
    return;
  }

  const card = data.card as WSCardType;
  if (!CARD_TYPES.includes(card)) {
    socket.emit('error', { message: '올바른 카드 종류가 아닙니다.' });
    return;
  }

  resetTimeout(s, myId);

  const error = trySubmitCard(io, s, myId, card);
  if (error) {
    socket.emit('error', { message: error });
    return;
  }

  if (s.playMode === 'com' && s.phase === 'cardSelect') {
    handleAiTurn(io, s);
  }
}

export function canWinningStreakUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'cardSelect';
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

export function cleanupWinningStreak(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getWinningStreakState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitWinningStreakStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}
