import type { GameState } from '@shared/types/events.js';
import { cloneKingmakingBoard } from '@shared/logic/kingmaking.js';
import type {
  KingmakingArchiveRecord,
  KingmakingGameData,
  KingmakingLastAction,
} from '@shared/types/kingmaking.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { KingmakingState } from './types.js';

export const kingmakingStates = new Map<string, KingmakingState>();

function cloneAction(entry: KingmakingLastAction): KingmakingLastAction {
  return {
    ...entry,
    action:
      entry.action.type === 'place'
        ? { ...entry.action, to: { ...entry.action.to } }
        : {
            ...entry.action,
            from: { ...entry.action.from },
            to: { ...entry.action.to },
          },
  };
}

function nicknameFor(
  state: KingmakingState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return nicknameForViewer(state.roomId, playerId, nickname, viewerId);
}

export function toKingmakingGameData(
  state: KingmakingState,
  viewerId: string | null,
): KingmakingGameData {
  return {
    board: cloneKingmakingBoard(state.board),
    players: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        { nickname: nicknameFor(state, viewerId, player.id, player.nickname) },
      ]),
    ),
    reserves: Object.fromEntries(
      state.players.map((player) => {
        const reserve = state.reserves[player.id];
        return [player.id, { normal: reserve.normal.length, special: reserve.special ? 1 : 0 }];
      }),
    ),
    currentPlayerId: state.currentPlayerId,
    firstPlayerId: state.firstPlayerId,
    turnNumber: state.turnNumber,
    phase: state.gameOver ? 'finished' : 'playing',
    lastAction: state.lastAction ? cloneAction(state.lastAction) : null,
    winnerId: state.winnerId,
    winType: state.winType,
    finishReason: state.finishReason,
    turnStartedAt:
      state.gameOver || state.currentPlayerId === AI_PLAYER_ID ? null : state.turnStartedAt,
    timeLimitSeconds: state.timeLimitSeconds,
  };
}

function toGameState(state: KingmakingState, data: KingmakingGameData): GameState {
  return {
    roomId: state.roomId,
    message: state.gameOver
      ? (state.finishReason ?? '게임 종료')
      : `${data.players[state.currentPlayerId]?.nickname ?? '플레이어'} 님의 차례입니다.`,
    currentTurn: state.gameOver ? null : state.currentPlayerId,
    turnNumber: state.turnNumber,
    startedAt: state.startedAt,
    turnStartedAt: data.turnStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

export async function broadcastKingmakingState(io: IO, state: KingmakingState) {
  if (state.reviewing) return;
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const viewerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === viewerId);
    socket.emit(
      'game:state',
      toGameState(state, toKingmakingGameData(state, isPlayer ? viewerId : null)),
    );
  }
}

export function emitKingmakingStateToSocket(socket: TypedSocket, roomId: string) {
  const state = kingmakingStates.get(roomId);
  if (!state) return;
  const viewerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === viewerId);
  socket.emit(
    'game:state',
    toGameState(state, toKingmakingGameData(state, isPlayer ? viewerId : null)),
  );
}

export function clearKingmakingTimers(state: KingmakingState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.turnTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toKingmakingRecord(state: KingmakingState): KingmakingArchiveRecord {
  return {
    initialBoard: cloneKingmakingBoard(state.initialBoard),
    finalBoard: cloneKingmakingBoard(state.board),
    actions: state.actionLog.map(cloneAction),
    finalReserves: Object.fromEntries(
      state.players.map((player) => {
        const reserve = state.reserves[player.id];
        return [player.id, { normal: reserve.normal.length, special: reserve.special ? 1 : 0 }];
      }),
    ),
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    winType: state.winType,
    finishReason: state.finishReason ?? '게임 종료',
  };
}
