import type { GameState } from '@shared/types/events.js';
import type { LoopCheckArchiveRecord, LoopCheckGameData } from '@shared/types/loop-check.js';
import { sessions } from '../../../store/sessions.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import { socketRoom } from '../../utils.js';
import type { IO, TypedSocket } from '../../types.js';
import type { LoopCheckState } from './types.js';

export const loopCheckStates = new Map<string, LoopCheckState>();

export function toLoopCheckGameData(
  state: LoopCheckState,
  viewerId: string | null,
): LoopCheckGameData {
  return {
    phase: state.phase,
    round: state.round,
    roundId: state.roundId,
    bestOf: state.bestOf,
    winScore: state.winScore,
    colorMode: state.colorMode,
    board: { cells: [...state.board.cells] },
    scores: { ...state.scores },
    players: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        {
          nickname: nicknameForViewer(state.roomId, player.id, player.nickname, viewerId),
        },
      ]),
    ),
    roundStartedAt: state.roundStartedAt,
    roundSeconds: state.roundSeconds,
    lastResult: state.lastResult,
    history: [...state.history],
    myFeedback: viewerId ? (state.feedbackByPlayer[viewerId] ?? null) : null,
    isSolo: state.playMode === 'solo',
  };
}

function projectState(state: LoopCheckState, viewerId: string | null): GameState {
  return {
    roomId: state.roomId,
    message:
      state.phase === 'playing'
        ? '경로 탐색'
        : state.phase === 'reveal'
          ? '라운드 결과'
          : '게임 종료',
    currentTurn: null,
    turnNumber: state.round,
    startedAt: state.startedAt,
    turnStartedAt: state.roundStartedAt,
    gameData: toLoopCheckGameData(state, viewerId) as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

export async function broadcastLoopCheckState(io: IO, state: LoopCheckState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const id = sessions.getToken(socket.id) ?? socket.id;
    socket.emit(
      'game:state',
      projectState(state, state.players.some((player) => player.id === id) ? id : null),
    );
  }
}

export function emitLoopCheckStateToSocket(socket: TypedSocket, roomId: string) {
  const state = loopCheckStates.get(roomId);
  if (!state) return;
  const id = sessions.getToken(socket.id) ?? socket.id;
  socket.emit(
    'game:state',
    projectState(state, state.players.some((player) => player.id === id) ? id : null),
  );
}

export function clearLoopCheckTimers(state: LoopCheckState) {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.transitionTimer) clearTimeout(state.transitionTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.roundTimer = null;
  state.transitionTimer = null;
  state.aiTimer = null;
}

export function toLoopCheckRecord(state: LoopCheckState): LoopCheckArchiveRecord {
  return {
    bestOf: state.bestOf,
    winScore: state.winScore,
    colorMode: state.colorMode,
    finalScores: { ...state.scores },
    history: [...state.history],
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
  };
}
