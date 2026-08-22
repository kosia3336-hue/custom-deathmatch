import type { GameState } from '@shared/types/events.js';
import {
  CH_MATCH_SECONDS,
  type CompleteHapArchiveRecord,
  type CompleteHapClaim,
  type CompleteHapGameData,
} from '@shared/types/complete-hap.js';
import { sessions } from '../../../store/sessions.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { CompleteHapState } from './types.js';

export const completeHapStates = new Map<string, CompleteHapState>();

function cloneClaim(claim: CompleteHapClaim): CompleteHapClaim {
  return { ...claim, cardIndexes: [...claim.cardIndexes] };
}

function nicknameFor(
  state: CompleteHapState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return isTokenAnonymized(state.roomId, playerId) && playerId !== viewerId
    ? ANONYMOUS_NICKNAME
    : nickname;
}

export function toCompleteHapGameData(
  state: CompleteHapState,
  viewerId: string | null,
): CompleteHapGameData {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  return {
    phase: state.phase,
    boards: state.boards.map((board) => ({
      cards: board.cards.map((card) => ({ ...card })),
      claims: board.claims.map(cloneClaim),
    })),
    correctCounts: { ...state.correctCounts },
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [
        player.id,
        { nickname: nicknameFor(state, viewerId, player.id, player.nickname) },
      ]),
    ),
    matchStartedAt: state.matchStartedAt,
    matchSeconds: CH_MATCH_SECONDS,
    claims: state.claims.map(cloneClaim),
    lastClaim: state.lastClaim ? cloneClaim(state.lastClaim) : null,
    isSolo: state.playMode === 'solo',
    playMode: state.playMode,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function toGameState(state: CompleteHapState, data: CompleteHapGameData): GameState {
  return {
    roomId: state.roomId,
    message:
      state.phase === 'playing'
        ? '세 문제에서 아직 선점되지 않은 합을 먼저 외치세요!'
        : (state.finishReason ?? '게임 종료'),
    currentTurn: null,
    turnNumber: state.claims.length + 1,
    startedAt: state.matchStartedAt,
    turnStartedAt: state.matchStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

export async function broadcastCompleteHapState(io: IO, state: CompleteHapState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(state, toCompleteHapGameData(state, isPlayer ? playerId : null)),
    );
  }
}

export function emitCompleteHapStateToSocket(socket: TypedSocket, roomId: string) {
  const state = completeHapStates.get(roomId);
  if (!state) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(state, toCompleteHapGameData(state, isPlayer ? playerId : null)),
  );
}

export function clearCompleteHapTimers(state: CompleteHapState) {
  if (state.matchTimer) clearTimeout(state.matchTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.matchTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toCompleteHapRecord(state: CompleteHapState): CompleteHapArchiveRecord {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  return {
    boards: state.boards.map((board) => ({
      cards: board.cards.map((card) => ({ ...card })),
      claims: board.claims.map(cloneClaim),
      allSets: board.allSets.map((set) => [...set]),
    })),
    finalCorrectCounts: { ...state.correctCounts },
    claims: state.claims.map(cloneClaim),
    tiebreak: state.tiebreak,
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
  };
}
