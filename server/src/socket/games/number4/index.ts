import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { NF4Number } from '@shared/types/number4.js';
import { INITIAL_SCORE, INITIAL_WHITE, INITIAL_BLACK, TILES_PER_ROUND } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, NF4PlayerInternal } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startRoundTimer,
  clearRoundTimer,
  processRound,
  performNumberFourUndo,
} from './state.js';
import { aiSubmit } from './ai.js';

export type { EndGameFn };
export { performNumberFourUndo };

export function initNumberFour(
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

  let p1: NF4PlayerInternal;
  let p2: NF4PlayerInternal;

  if (playMode === 'solo') {
    p1 = makePlayer(players[0].id, `${players[0].nickname} (1P)`);
    p2 = makePlayer(players[0].id + '_p2', `${players[0].nickname} (2P)`);
  } else {
    p1 = makePlayer(players[0].id, players[0].nickname);
    p2 = makePlayer(players[1].id, players[1].nickname);
  }

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'submit',
    player1: p1,
    player2: p2,
    roundHistory: [],
    winner: null,
    winType: null,
    tiebreakerReason: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    roundTimer: null,
    playMode,
    gameOver: false,
    actionLog: [],
    currentSide: playMode === 'solo' ? 'player1' : null,
    aiTargetNumber: null,
    undoSnapshots: [],
    aiGeneration: 0,
  });

  const s = gameStates.get(roomId)!;
  startRoundTimer(io, s);
  broadcastState(io, s);
}

function makePlayer(id: string, nickname: string): NF4PlayerInternal {
  return {
    id,
    nickname,
    score: INITIAL_SCORE,
    remainingWhite: INITIAL_WHITE,
    remainingBlack: INITIAL_BLACK,
    submitted: false,
    submittedWhite: null,
    submittedBlack: null,
    submittedNumber: null,
  };
}

export function handleNumberFourAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  switch (data.type) {
    case 'submit':
      handleSubmit(io, socket, s, data);
      break;
  }
}

function handleSubmit(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  data: Record<string, unknown>,
) {
  if (s.phase !== 'submit') {
    socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
    return;
  }

  const white = data.white;
  const black = data.black;
  const num = data.number;

  if (typeof white !== 'number' || typeof black !== 'number') return;
  if (!Number.isInteger(white) || !Number.isInteger(black)) return;
  if (white + black !== TILES_PER_ROUND) {
    socket.emit('error', { message: '백색과 흑색 타일의 합이 7개여야 합니다.' });
    return;
  }
  if (typeof num !== 'number' || !Number.isInteger(num) || num < 0 || num > 4) {
    socket.emit('error', { message: '0~4 사이의 넘버를 선택해 주세요.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const player = getActionPlayer(s, myId);
  if (!player) return;

  if (player.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }

  if (white < 0 || white > player.remainingWhite || black < 0 || black > player.remainingBlack) {
    socket.emit('error', { message: '보유한 타일 수를 초과했습니다.' });
    return;
  }

  player.submittedWhite = white;
  player.submittedBlack = black;
  player.submittedNumber = num as NF4Number;
  player.submitted = true;

  if (s.playMode === 'solo') {
    if (s.currentSide === 'player1') {
      s.currentSide = 'player2';
      broadcastState(io, s);
      return;
    } else {
      s.currentSide = null;
    }
  }

  if (s.player1.submitted && s.player2.submitted) {
    processRound(io, s);
    return;
  }

  broadcastState(io, s);

  if (s.playMode === 'com' && myId !== AI_PLAYER_ID) {
    aiSubmit(io, s);
  }
}

function getActionPlayer(
  s: import('./types.js').InternalState,
  socketId: string,
): NF4PlayerInternal | null {
  if (s.playMode === 'solo') {
    return s.currentSide === 'player1' ? s.player1 : s.player2;
  }
  if (s.player1.id === socketId) return s.player1;
  if (s.player2.id === socketId) return s.player2;
  return null;
}

export function canNumberFourUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial =
    s.phase !== 'submit' ||
    s.player1.submitted || s.player2.submitted ||
    s.player1.submittedWhite !== null || s.player2.submittedWhite !== null;
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

export function cleanupNumberFour(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getNumberFourState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitNumberFourStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}
