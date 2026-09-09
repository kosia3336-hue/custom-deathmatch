import type { GameState } from '@shared/types/events.js';
import type {
  KnightTourArchiveRecord,
  KnightTourCell,
  KnightTourGameData,
  KnightTourRoundResult,
} from '@shared/types/knights-tour.js';
import { sessions } from '../../../store/sessions.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { KnightTourState } from './types.js';

export const knightTourStates = new Map<string, KnightTourState>();

function cloneCells(cells: KnightTourCell[]) {
  return cells.map((cell) => ({ ...cell }));
}

function cloneResult(result: KnightTourRoundResult): KnightTourRoundResult {
  return {
    ...result,
    winningPath: cloneCells(result.winningPath),
    paths: Object.fromEntries(
      Object.entries(result.paths).map(([playerId, path]) => [playerId, cloneCells(path)]),
    ),
    visitedCounts: { ...result.visitedCounts },
    submissionElapsedMs: { ...result.submissionElapsedMs },
    autoSubmitted: { ...result.autoSubmitted },
    solution: cloneCells(result.solution),
    scoresAfter: { ...result.scoresAfter },
  };
}

function nicknameFor(
  state: KnightTourState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return nicknameForViewer(state.roomId, playerId, nickname, viewerId);
}

export function toKnightTourGameData(
  state: KnightTourState,
  viewerId: string | null,
): KnightTourGameData {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  const round = state.rounds[state.currentRoundIndex];
  return {
    phase: state.phase,
    board: {
      ...round.board,
      activeCells: cloneCells(round.board.activeCells),
    },
    round: state.currentRoundIndex + 1,
    totalRounds: state.totalRounds,
    scores: { ...state.scores },
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [
        player.id,
        { nickname: nicknameFor(state, viewerId, player.id, player.nickname) },
      ]),
    ),
    progress: Object.fromEntries(
      [...uniquePlayers.keys()].map((playerId) => {
        const path = state.paths[playerId] ?? [];
        const submission = state.submissions[playerId];
        const maySeePath = playerId === viewerId || state.phase !== 'playing';
        return [
          playerId,
          {
            current: path.at(-1) ? { ...path.at(-1)! } : null,
            visitedCount: path.length,
            submitted: Boolean(submission),
            submittedElapsedMs: submission
              ? Math.max(0, submission.submittedAt - state.roundStartedAt)
              : null,
            ...(maySeePath ? { path: cloneCells(path) } : {}),
          },
        ];
      }),
    ),
    roundStartedAt: state.roundStartedAt,
    roundSeconds: state.roundSeconds,
    lastRoundResult: state.lastRoundResult ? cloneResult(state.lastRoundResult) : null,
    isSolo: state.playMode === 'solo',
    playMode: state.playMode,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function toGameState(state: KnightTourState, data: KnightTourGameData): GameState {
  const message =
    state.phase === 'playing'
      ? '60초 동안 최대한 많은 칸을 방문한 뒤 제출하세요!'
      : state.phase === 'round-result'
        ? state.lastRoundResult?.winnerId
          ? '더 많은 칸을 방문한 플레이어가 라운드에서 승리했습니다.'
          : '동일한 기록으로 라운드가 무승부가 되었습니다.'
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

export async function broadcastKnightTourState(io: IO, state: KnightTourState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(state, toKnightTourGameData(state, isPlayer ? playerId : null)),
    );
  }
}

export function emitKnightTourStateToSocket(socket: TypedSocket, roomId: string) {
  const state = knightTourStates.get(roomId);
  if (!state) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(state, toKnightTourGameData(state, isPlayer ? playerId : null)),
  );
}

export function clearKnightTourTimers(state: KnightTourState) {
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.transitionTimer) clearTimeout(state.transitionTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.roundTimer = null;
  state.transitionTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toKnightTourRecord(state: KnightTourState): KnightTourArchiveRecord {
  const uniquePlayers = new Map(state.players.map((player) => [player.id, player]));
  return {
    rounds: state.rounds.map((round, index) => ({
      round: index + 1,
      board: { ...round.board, activeCells: cloneCells(round.board.activeCells) },
      solution: cloneCells(round.solution),
      result: round.result ? cloneResult(round.result) : null,
    })),
    totalRounds: state.totalRounds,
    finalScores: { ...state.scores },
    roundResults: state.roundResults.map(cloneResult),
    tiebreak: state.tiebreak,
    players: Object.fromEntries(
      [...uniquePlayers.values()].map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
  };
}
