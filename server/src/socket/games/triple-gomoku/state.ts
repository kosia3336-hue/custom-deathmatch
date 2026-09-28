import { cloneTripleGomokuBoard } from '@shared/logic/triple-gomoku.js';
import type { GameState } from '@shared/types/events.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type {
  TripleGomokuArchiveRecord,
  TripleGomokuGameData,
  TripleGomokuLastAction,
} from '@shared/types/triple-gomoku.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { sessions } from '../../../store/sessions.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { TripleGomokuState } from './types.js';

export const tripleGomokuStates = new Map<string, TripleGomokuState>();

function cloneAction(entry: TripleGomokuLastAction): TripleGomokuLastAction {
  return {
    ...entry,
    action:
      entry.action.type === 'place'
        ? { type: 'place', to: { ...entry.action.to } }
        : {
            type: 'move',
            from: { ...entry.action.from },
            to: { ...entry.action.to },
          },
  };
}

function nicknameFor(
  state: TripleGomokuState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return nicknameForViewer(state.roomId, playerId, nickname, viewerId);
}

export function toTripleGomokuGameData(
  state: TripleGomokuState,
  viewerId: string | null,
): TripleGomokuGameData {
  return {
    board: cloneTripleGomokuBoard(state.board),
    players: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        { nickname: nicknameFor(state, viewerId, player.id, player.nickname) },
      ]),
    ),
    reserves: { ...state.reserves },
    currentPlayerId: state.currentPlayerId,
    firstPlayerId: state.firstPlayerId,
    phase: state.phase,
    turnNumber: state.turnNumber,
    setupRemaining: state.phase === 'setup' ? state.setupRemaining : 0,
    lastAction: state.lastAction ? cloneAction(state.lastAction) : null,
    winnerId: state.winnerId,
    winType: state.winType,
    winCells: state.winCells.map((cell) => ({ ...cell })),
    finishReason: state.finishReason,
    turnStartedAt:
      state.gameOver || state.currentPlayerId === AI_PLAYER_ID ? null : state.turnStartedAt,
    timeLimitSeconds: state.timeLimitSeconds,
  };
}

function toGameState(state: TripleGomokuState, data: TripleGomokuGameData): GameState {
  const nickname = data.players[state.currentPlayerId]?.nickname ?? '플레이어';
  const message = state.gameOver
    ? (state.finishReason ?? '게임 종료')
    : state.phase === 'setup'
      ? `기본 배치 — ${nickname} 님이 ${state.setupRemaining}개를 놓습니다.`
      : `${nickname} 님의 차례입니다.`;
  return {
    roomId: state.roomId,
    message,
    currentTurn: state.gameOver ? null : state.currentPlayerId,
    turnNumber: state.turnNumber,
    startedAt: state.startedAt,
    turnStartedAt: data.turnStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

export async function broadcastTripleGomokuState(io: IO, state: TripleGomokuState) {
  if (state.reviewing) return;
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const viewerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === viewerId);
    socket.emit(
      'game:state',
      toGameState(state, toTripleGomokuGameData(state, isPlayer ? viewerId : null)),
    );
  }
}

export function emitTripleGomokuStateToSocket(socket: TypedSocket, roomId: string) {
  const state = tripleGomokuStates.get(roomId);
  if (!state) return;
  const viewerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === viewerId);
  socket.emit(
    'game:state',
    toGameState(state, toTripleGomokuGameData(state, isPlayer ? viewerId : null)),
  );
}

export function clearTripleGomokuTimers(state: TripleGomokuState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.turnTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toTripleGomokuRecord(state: TripleGomokuState): TripleGomokuArchiveRecord {
  return {
    finalBoard: cloneTripleGomokuBoard(state.board),
    actions: state.actionLog.map(cloneAction),
    finalReserves: { ...state.reserves },
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    firstPlayerId: state.firstPlayerId,
    winnerId: state.winnerId,
    winType: state.winType,
    winCells: state.winCells.map((cell) => ({ ...cell })),
    finishReason: state.finishReason ?? '게임 종료',
  };
}
