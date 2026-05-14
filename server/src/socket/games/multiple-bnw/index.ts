import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { MBNWTile } from '@shared/types/multiple-bnw.js';
import { MBNW_TILE_SET, MBNW_TILE_COLOR, MBNW_TOTAL_ROUNDS } from '@shared/types/multiple-bnw.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, MBNWPlayerInternal } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startRoundWithSnapshot,
  startPhaseTimer,
  clearRoundTimer,
  processRound,
  resetTimeout,
  getFirstPlayer,
  getSecondPlayer,
  performMultipleBnwUndo,
} from './state.js';
import { judgeMultiple } from './judge.js';
import { handleAiTurn } from './ai.js';

export type { EndGameFn };
export { performMultipleBnwUndo };

export function initMultipleBnw(
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

  const tiles = [...MBNW_TILE_SET] as MBNWTile[];
  const firstIdx = 0;
  const secondIdx = 1;

  const p1 = makePlayer(players[0].id, players[0].nickname, tiles, firstIdx === 0);
  const p2 = makePlayer(players[1].id, players[1].nickname, tiles, firstIdx === 1);

  const firstPlayerId = players[firstIdx].id;
  const secondPlayerId = players[secondIdx].id;

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'tileSubmit',
    firstPlayerId,
    secondPlayerId,
    initialFirstPlayerId: firstPlayerId,
    player1: p1,
    player2: p2,
    colorReveal: null,
    suspectResult: null,
    roundHistory: [],
    actionLog: [],
    suspectSuccessCount: { [p1.id]: 0, [p2.id]: 0 },
    firstPlayerRounds: { [firstPlayerId]: 1, [secondPlayerId]: 0 },
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

function makePlayer(id: string, nickname: string, tiles: MBNWTile[], isFirst: boolean): MBNWPlayerInternal {
  return {
    id,
    nickname,
    score: 0,
    remainingTiles: [...tiles],
    submitted: false,
    isFirst,
    currentTile: null,
  };
}

export function handleMultipleBnwAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;

  switch (data.type) {
    case 'submitTile':
      handleSubmitTile(io, socket, s, myId, data.tile as number);
      break;
    case 'respondTile':
      handleRespondTile(io, socket, s, myId, data.tile as number);
      break;
    case 'suspectFirst':
      handleSuspectFirst(io, socket, s, myId, data.suspect as boolean);
      break;
    case 'suspectSecond':
      handleSuspectSecond(io, socket, s, myId, data.suspect as boolean);
      break;
  }
}

function handleSubmitTile(io: IO, socket: TypedSocket, s: import('./types.js').InternalState, myId: string, tile: number) {
  if (s.phase !== 'tileSubmit') {
    socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
    return;
  }
  const fp = getFirstPlayer(s);
  if (fp.id !== myId) {
    socket.emit('error', { message: '지금은 당신의 차례가 아닙니다.' });
    return;
  }
  if (fp.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }
  if (!MBNW_TILE_SET.includes(tile as MBNWTile) || !fp.remainingTiles.includes(tile as MBNWTile)) {
    socket.emit('error', { message: '올바른 타일 값이 아닙니다.' });
    return;
  }

  resetTimeout(s, myId);
  clearRoundTimer(s);

  fp.currentTile = tile as MBNWTile;
  fp.submitted = true;
  s.colorReveal = { firstPlayerColor: MBNW_TILE_COLOR[tile as MBNWTile], secondPlayerColor: null };
  s.phase = 'tileRespond';

  startPhaseTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') handleAiTurn(io, s);
}

function handleRespondTile(io: IO, socket: TypedSocket, s: import('./types.js').InternalState, myId: string, tile: number) {
  if (s.phase !== 'tileRespond') {
    socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
    return;
  }
  const sp = getSecondPlayer(s);
  if (sp.id !== myId) {
    socket.emit('error', { message: '지금은 당신의 차례가 아닙니다.' });
    return;
  }
  if (sp.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }
  if (!MBNW_TILE_SET.includes(tile as MBNWTile) || !sp.remainingTiles.includes(tile as MBNWTile)) {
    socket.emit('error', { message: '올바른 타일 값이 아닙니다.' });
    return;
  }

  resetTimeout(s, myId);
  clearRoundTimer(s);

  sp.currentTile = tile as MBNWTile;
  sp.submitted = true;
  s.colorReveal!.secondPlayerColor = MBNW_TILE_COLOR[tile as MBNWTile];
  s.phase = 'suspectFirst';

  startPhaseTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com') handleAiTurn(io, s);
}

function handleSuspectFirst(io: IO, socket: TypedSocket, s: import('./types.js').InternalState, myId: string, suspect: boolean) {
  if (s.phase !== 'suspectFirst') {
    socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
    return;
  }
  const fp = getFirstPlayer(s);
  if (fp.id !== myId) {
    socket.emit('error', { message: '지금은 당신의 차례가 아닙니다.' });
    return;
  }
  if (typeof suspect !== 'boolean') {
    socket.emit('error', { message: '배수의심 선언 값이 올바르지 않습니다.' });
    return;
  }

  resetTimeout(s, myId);
  clearRoundTimer(s);

  const sp = getSecondPlayer(s);

  if (!suspect) {
    s.suspectResult = { firstSuspected: false, firstSuccess: null, secondSkipped: false, secondSuspected: null, secondSuccess: null };
    s.phase = 'suspectSecond';
    startPhaseTimer(io, s);
    broadcastState(io, s);
    if (s.playMode === 'com') handleAiTurn(io, s);
  } else {
    const result = judgeMultiple(fp.currentTile!, sp.currentTile!);
    s.suspectResult = {
      firstSuspected: true,
      firstSuccess: result.success,
      secondSkipped: result.success,
      secondSuspected: null,
      secondSuccess: null,
    };
    if (result.success) {
      processRound(io, s);
    } else {
      // 실패: 후 의심 스킵하고 바로 정산 (패널티 +1은 processRound에서 처리)
      s.suspectResult!.secondSkipped = true;
      processRound(io, s);
    }
  }
}

function handleSuspectSecond(io: IO, socket: TypedSocket, s: import('./types.js').InternalState, myId: string, suspect: boolean) {
  if (s.phase !== 'suspectSecond') {
    socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
    return;
  }
  const sp = getSecondPlayer(s);
  if (sp.id !== myId) {
    socket.emit('error', { message: '지금은 당신의 차례가 아닙니다.' });
    return;
  }
  if (typeof suspect !== 'boolean') {
    socket.emit('error', { message: '배수의심 선언 값이 올바르지 않습니다.' });
    return;
  }

  resetTimeout(s, myId);
  clearRoundTimer(s);

  s.suspectResult!.secondSuspected = suspect;
  processRound(io, s);
}

export function canMultipleBnwUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'tileSubmit';
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

export function cleanupMultipleBnw(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getMultipleBnwState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitMultipleBnwStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export { getMultipleBnwResultData } from './state.js';
