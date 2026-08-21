import type { GameState } from '@shared/types/events.js';
import {
  CH_CALL_SECONDS,
  CH_MATCH_SECONDS,
  CH_TURN_SECONDS,
  type CompleteHapArchiveRecord,
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
      claimedSets: board.claimedSets.map((set) => [...set]),
      completed: board.completed,
    })),
    scores: { ...state.scores },
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [
        player.id,
        { nickname: nicknameFor(state, viewerId, player.id, player.nickname) },
      ]),
    ),
    currentPlayerId: state.currentPlayerId,
    selectedBoardIndex: state.selectedBoardIndex,
    turn: state.turn,
    phaseStartedAt: state.phaseStartedAt,
    matchStartedAt: state.matchStartedAt,
    matchSeconds: CH_MATCH_SECONDS,
    turnSeconds: CH_TURN_SECONDS,
    callSeconds: CH_CALL_SECONDS,
    actionLog: state.actionLog.map((record) => ({
      ...record,
      cardIndexes: record.cardIndexes ? [...record.cardIndexes] : null,
    })),
    lastAction: state.lastAction
      ? {
          ...state.lastAction,
          cardIndexes: state.lastAction.cardIndexes ? [...state.lastAction.cardIndexes] : null,
        }
      : null,
    isSolo: state.playMode === 'solo',
    playMode: state.playMode,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function messageFor(state: CompleteHapState) {
  if (state.phase === 'finished') return state.finishReason ?? '게임 종료';
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  if (state.phase === 'selecting')
    return `${player?.nickname ?? '플레이어'} — 5초 안에 카드 3장을 호명하세요!`;
  return `${player?.nickname ?? '플레이어'}의 차례 — 합 또는 결을 판단하세요!`;
}

function toGameState(state: CompleteHapState, data: CompleteHapGameData): GameState {
  return {
    roomId: state.roomId,
    message: messageFor(state),
    currentTurn: state.phase === 'finished' ? null : state.currentPlayerId,
    turnNumber: state.turn,
    startedAt: state.matchStartedAt,
    // 공통 GameShell의 room.timeLimitSeconds(600)는 전체 매치 타이머다.
    // 세부 10초/5초 타이머는 gameData.phaseStartedAt으로 별도 표시한다.
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
  if (state.phaseTimer) clearTimeout(state.phaseTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.matchTimer = null;
  state.phaseTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toCompleteHapRecord(state: CompleteHapState): CompleteHapArchiveRecord {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  return {
    boards: state.boards.map((board) => ({
      cards: board.cards.map((card) => ({ ...card })),
      claimedSets: board.claimedSets.map((set) => [...set]),
      completed: board.completed,
      allSets: board.allSets.map((set) => [...set]),
    })),
    finalScores: { ...state.scores },
    correctElapsedMs: { ...state.correctElapsedMs },
    actionLog: state.actionLog.map((record) => ({
      ...record,
      cardIndexes: record.cardIndexes ? [...record.cardIndexes] : null,
    })),
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
  };
}
