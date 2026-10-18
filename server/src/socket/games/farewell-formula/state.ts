import type { GameState } from '@shared/types/events.js';
import {
  FF_TOTAL_ROUNDS,
  type FarewellFormulaArchiveRecord,
  type FarewellFormulaGameData,
} from '@shared/types/farewell-formula.js';
import { sessions } from '../../../store/sessions.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { FarewellFormulaState } from './types.js';

export const farewellFormulaStates = new Map<string, FarewellFormulaState>();

function maskNickname(
  state: FarewellFormulaState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return nicknameForViewer(state.roomId, playerId, nickname, viewerId);
}

export function toFarewellFormulaGameData(
  state: FarewellFormulaState,
  viewerId: string | null,
): FarewellFormulaGameData {
  const [first, second] = state.players;
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: FF_TOTAL_ROUNDS,
    source: state.puzzle.source,
    tokens: state.puzzle.tokens.map((token) => ({ ...token })),
    goodbyeCount: state.puzzle.goodbyeCount,
    scores: { ...state.scores },
    players: {
      [first.id]: { nickname: maskNickname(state, viewerId, first.id, first.nickname) },
      [second.id]: { nickname: maskNickname(state, viewerId, second.id, second.nickname) },
    },
    roundStartedAt: state.roundStartedAt,
    roundSeconds: state.roundSeconds,
    lastResult: state.lastResult,
    history: [...state.history],
    myFeedback: viewerId ? (state.feedbackByPlayer[viewerId] ?? null) : null,
    isSolo: state.playMode === 'solo',
  };
}

function toGameState(state: FarewellFormulaState, gameData: FarewellFormulaGameData): GameState {
  const message =
    state.phase === 'playing'
      ? `라운드 ${state.round}/${FF_TOTAL_ROUNDS} — ${state.puzzle.goodbyeCount}번 이별하세요.`
      : state.phase === 'reveal'
        ? `라운드 ${state.round} 결과`
        : '게임 종료';
  return {
    roomId: state.roomId,
    message,
    currentTurn: null,
    turnNumber: state.round,
    startedAt: state.startedAt,
    turnStartedAt: state.roundStartedAt,
    gameData: gameData as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

export async function broadcastFarewellFormulaState(io: IO, state: FarewellFormulaState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(state, toFarewellFormulaGameData(state, isPlayer ? playerId : null)),
    );
  }
}

export function emitFarewellFormulaStateToSocket(socket: TypedSocket, roomId: string) {
  const state = farewellFormulaStates.get(roomId);
  if (!state) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(state, toFarewellFormulaGameData(state, isPlayer ? playerId : null)),
  );
}

export function clearFarewellFormulaTimers(state: FarewellFormulaState) {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.transitionTimer) clearTimeout(state.transitionTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.roundTimer = null;
  state.transitionTimer = null;
  state.aiTimer = null;
}

export function toFarewellFormulaRecord(state: FarewellFormulaState): FarewellFormulaArchiveRecord {
  const [first, second] = state.players;
  return {
    finalScores: { ...state.scores },
    history: [...state.history],
    players: {
      [first.id]: { nickname: first.nickname },
      [second.id]: { nickname: second.nickname },
    },
  };
}
