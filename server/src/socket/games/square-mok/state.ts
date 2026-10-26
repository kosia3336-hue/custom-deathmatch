import { cloneSquareMokBoard, scoreSquareMok, squareMokQuota } from '@shared/logic/square-mok.js';
import type { GameState } from '@shared/types/events.js';
import type {
  SquareMokArchiveRecord,
  SquareMokGameData,
  SquareMokScore,
  SquareMokTurnLog,
} from '@shared/types/square-mok.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { sessions } from '../../../store/sessions.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { SquareMokState } from './types.js';

export const squareMokStates = new Map<string, SquareMokState>();

function cloneLog(entry: SquareMokTurnLog): SquareMokTurnLog {
  return { ...entry, cells: entry.cells.map((cell) => ({ ...cell })) };
}

export function squareMokScores(state: SquareMokState): Record<string, SquareMokScore> {
  return Object.fromEntries(state.players.map((p) => [p.id, scoreSquareMok(state.board, p.id)]));
}

export function toSquareMokGameData(
  state: SquareMokState,
  viewerId: string | null,
): SquareMokGameData {
  return {
    board: cloneSquareMokBoard(state.board),
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
    quota: state.gameOver ? 0 : squareMokQuota(state.turnNumber, state.board),
    history: state.history.map(cloneLog),
    scores: squareMokScores(state),
    winnerId: state.winnerId,
    decider: state.decider,
    finishReason: state.finishReason,
    turnStartedAt: state.gameOver ? null : state.turnStartedAt,
    timeLimitSeconds: state.timeLimitSeconds,
  };
}

function toGameState(state: SquareMokState, data: SquareMokGameData): GameState {
  const nickname = data.players[state.currentPlayerId]?.nickname ?? '플레이어';
  return {
    roomId: state.roomId,
    message: state.gameOver
      ? (state.finishReason ?? '게임 종료')
      : `${nickname} 님의 차례입니다. (${data.quota}개 놓기)`,
    currentTurn: state.gameOver ? null : state.currentPlayerId,
    turnNumber: state.turnNumber,
    startedAt: state.startedAt,
    turnStartedAt: data.turnStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

function viewerOf(state: SquareMokState, socketId: string) {
  const viewerId = sessions.getToken(socketId) ?? socketId;
  return state.players.some((player) => player.id === viewerId) ? viewerId : null;
}

export async function broadcastSquareMokState(io: IO, state: SquareMokState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    socket.emit(
      'game:state',
      toGameState(state, toSquareMokGameData(state, viewerOf(state, socket.id))),
    );
  }
}

export function emitSquareMokStateToSocket(socket: TypedSocket, roomId: string) {
  const state = squareMokStates.get(roomId);
  if (!state) return;
  socket.emit(
    'game:state',
    toGameState(state, toSquareMokGameData(state, viewerOf(state, socket.id))),
  );
}

export function clearSquareMokTimers(state: SquareMokState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.turnTimer = null;
  state.finishTimer = null;
}

export function toSquareMokRecord(state: SquareMokState): SquareMokArchiveRecord {
  return {
    actions: state.history.map(cloneLog),
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    firstPlayerId: state.players[0].id,
    secondPlayerId: state.players[1].id,
    finalBoard: cloneSquareMokBoard(state.board),
    scores: squareMokScores(state),
    winnerId: state.winnerId,
    decider: state.decider,
    finishReason: state.finishReason ?? '게임 종료',
  };
}
