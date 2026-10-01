import type { GameState } from '@shared/types/events.js';
import type {
  CompleteHapArchiveRecord,
  CompleteHapGameData,
  CompleteHapRoundResult,
} from '@shared/types/complete-hap.js';
import { sessions } from '../../../store/sessions.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { CompleteHapState } from './types.js';

export const completeHapStates = new Map<string, CompleteHapState>();

function cloneRoundResult(result: CompleteHapRoundResult): CompleteHapRoundResult {
  return {
    ...result,
    submittedSets: result.submittedSets.map((set) => [...set]),
    answerSets: result.answerSets.map((set) => [...set]),
  };
}

function nicknameFor(
  state: CompleteHapState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return nicknameForViewer(state.roomId, playerId, nickname, viewerId);
}

export function toCompleteHapGameData(
  state: CompleteHapState,
  viewerId: string | null,
): CompleteHapGameData {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  const round = state.rounds[state.currentRoundIndex];
  return {
    phase: state.phase,
    board: { cards: round.cards.map((card) => ({ ...card })) },
    round: state.currentRoundIndex + 1,
    totalRounds: state.totalRounds,
    scores: { ...state.scores },
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [
        player.id,
        { nickname: nicknameFor(state, viewerId, player.id, player.nickname) },
      ]),
    ),
    roundStartedAt: state.roundStartedAt,
    matchStartedAt: state.matchStartedAt,
    matchSeconds: state.matchSeconds,
    lastRoundResult: state.lastRoundResult ? cloneRoundResult(state.lastRoundResult) : null,
    isSolo: state.playMode === 'solo',
    playMode: state.playMode,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function toGameState(state: CompleteHapState, data: CompleteHapGameData): GameState {
  const message =
    state.phase === 'playing'
      ? '모든 합을 저장한 뒤 결을 외치세요!'
      : state.phase === 'round-result'
        ? state.lastRoundResult?.correct
          ? '정답입니다!'
          : state.playMode === 'solo'
            ? '오답입니다! 다음 라운드로 넘어갑니다.'
            : '오답입니다! 상대가 득점합니다.'
        : (state.finishReason ?? '게임 종료');
  return {
    roomId: state.roomId,
    message,
    currentTurn: null,
    turnNumber: state.currentRoundIndex + 1,
    startedAt: state.matchStartedAt,
    turnStartedAt: state.roundStartedAt,
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
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.matchTimer = null;
  state.roundTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toCompleteHapRecord(state: CompleteHapState): CompleteHapArchiveRecord {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  return {
    rounds: state.rounds.map((round, roundIndex) => ({
      round: roundIndex + 1,
      cards: round.cards.map((card) => ({ ...card })),
      allSets: round.allSets.map((set) => [...set]),
      result: round.result ? cloneRoundResult(round.result) : null,
    })),
    totalRounds: state.totalRounds,
    finalScores: { ...state.scores },
    roundResults: state.roundResults.map(cloneRoundResult),
    tiebreak: state.tiebreak,
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
  };
}
