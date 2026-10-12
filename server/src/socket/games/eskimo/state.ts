import { cloneEskimoBoard } from '@shared/logic/eskimo.js';
import type { GameState } from '@shared/types/events.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type {
  EskimoArchiveRecord,
  EskimoGameData,
  EskimoLastAction,
} from '@shared/types/eskimo.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { sessions } from '../../../store/sessions.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { EskimoState } from './types.js';

export const eskimoStates = new Map<string, EskimoState>();

function cloneAction(entry: EskimoLastAction): EskimoLastAction {
  return {
    ...entry,
    action: { type: 'move', from: { ...entry.action.from }, to: { ...entry.action.to } },
  };
}

export function toEskimoGameData(state: EskimoState, viewerId: string | null): EskimoGameData {
  return {
    board: cloneEskimoBoard(state.board),
    players: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        { nickname: nicknameForViewer(state.roomId, player.id, player.nickname, viewerId) },
      ]),
    ),
    firstPlayerId: state.firstPlayerId,
    currentPlayerId: state.currentPlayerId,
    phase: state.phase,
    turnNumber: state.turnNumber,
    bearLockTurns: state.bearLockTurns,
    lastAction: state.lastAction ? cloneAction(state.lastAction) : null,
    history: state.actionLog.map(cloneAction),
    positions: [...state.positions],
    winnerId: state.winnerId,
    winType: state.winType,
    winCells: state.winCells.map((cell) => ({ ...cell })),
    finishReason: state.finishReason,
    turnStartedAt:
      state.gameOver || state.currentPlayerId === AI_PLAYER_ID ? null : state.turnStartedAt,
    timeLimitSeconds: state.timeLimitSeconds,
  };
}

function toGameState(state: EskimoState, data: EskimoGameData): GameState {
  const nickname = data.players[state.currentPlayerId]?.nickname ?? '플레이어';
  return {
    roomId: state.roomId,
    message: state.gameOver ? (state.finishReason ?? '게임 종료') : `${nickname} 님의 차례입니다.`,
    currentTurn: state.gameOver ? null : state.currentPlayerId,
    turnNumber: state.turnNumber,
    startedAt: state.startedAt,
    turnStartedAt: data.turnStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

function viewerOf(state: EskimoState, socketId: string) {
  const viewerId = sessions.getToken(socketId) ?? socketId;
  return state.players.some((player) => player.id === viewerId) ? viewerId : null;
}

export async function broadcastEskimoState(io: IO, state: EskimoState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    socket.emit(
      'game:state',
      toGameState(state, toEskimoGameData(state, viewerOf(state, socket.id))),
    );
  }
}

export function emitEskimoStateToSocket(socket: TypedSocket, roomId: string) {
  const state = eskimoStates.get(roomId);
  if (!state) return;
  socket.emit(
    'game:state',
    toGameState(state, toEskimoGameData(state, viewerOf(state, socket.id))),
  );
}

export function clearEskimoTimers(state: EskimoState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.turnTimer = null;
  state.finishTimer = null;
  state.aiTimer = null;
}

export function toEskimoRecord(state: EskimoState): EskimoArchiveRecord {
  return {
    actions: state.actionLog.map(cloneAction),
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    firstPlayerId: state.players[0].id,
    secondPlayerId: state.players[1].id,
    finalBoard: cloneEskimoBoard(state.board),
    winnerId: state.winnerId,
    winType: state.winType,
    winCells: state.winCells.map((cell) => ({ ...cell })),
    finishReason: state.finishReason ?? '게임 종료',
  };
}
