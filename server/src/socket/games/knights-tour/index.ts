import {
  KT_TOTAL_ROUNDS,
  KT_WIN_SCORE,
  type KnightTourAction,
  type KnightTourCell,
  type KnightTourRoundResult,
  type KnightTourTiebreak,
} from '@shared/types/knights-tour.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { dealKnightTourRounds, isKnightMove, knightTourCellKey } from './generator.js';
import {
  broadcastKnightTourState,
  clearKnightTourTimers,
  emitKnightTourStateToSocket,
  knightTourStates,
  toKnightTourRecord,
} from './state.js';
import type { KnightTourEndGameFn, KnightTourState } from './types.js';

const ROUND_RESULT_MS = 2300;
const FINISH_DISPLAY_MS = 3000;
const AI_STEP_MIN_MS = 420;
const AI_STEP_MAX_MS = 760;

function scoreStats(state: KnightTourState, playerId: string) {
  const wins = state.roundResults.filter((result) => result.winnerId === playerId);
  const last = wins.at(-1);
  return {
    reachedAt: last?.matchElapsedMs ?? Number.POSITIVE_INFINITY,
    totalElapsed: wins.reduce((sum, result) => sum + (result.elapsedMs ?? 0), 0),
  };
}

export function knightTourRankings(state: KnightTourState) {
  const [first, second] = state.players;
  const firstScore = state.scores[first.id] ?? 0;
  if (state.playMode === 'solo') {
    return {
      rankings: [{ playerId: first.id, nickname: first.nickname, rank: 1, score: firstScore }],
      tiebreak: 'solo' as KnightTourTiebreak,
    };
  }
  const secondScore = state.scores[second.id] ?? 0;
  if (firstScore === 0 && secondScore === 0) {
    return {
      rankings: [
        { playerId: first.id, nickname: first.nickname, rank: 1, score: 0 },
        { playerId: second.id, nickname: second.nickname, rank: 1, score: 0 },
      ],
      tiebreak: 'zero-draw' as KnightTourTiebreak,
    };
  }
  let winner = first;
  let loser = second;
  let tiebreak: KnightTourTiebreak = 'count';
  if (firstScore !== secondScore) {
    winner = firstScore > secondScore ? first : second;
    loser = winner.id === first.id ? second : first;
  } else {
    tiebreak = 'speed';
    const firstStats = scoreStats(state, first.id);
    const secondStats = scoreStats(state, second.id);
    if (
      secondStats.reachedAt < firstStats.reachedAt ||
      (secondStats.reachedAt === firstStats.reachedAt &&
        secondStats.totalElapsed < firstStats.totalElapsed)
    ) {
      winner = second;
      loser = first;
    }
  }
  return {
    rankings: [
      {
        playerId: winner.id,
        nickname: winner.nickname,
        rank: 1,
        score: state.scores[winner.id] ?? 0,
      },
      { playerId: loser.id, nickname: loser.nickname, rank: 2, score: state.scores[loser.id] ?? 0 },
    ],
    tiebreak,
  };
}

function finishGame(io: IO, state: KnightTourState, baseReason: string) {
  if (state.gameOver) return;
  clearKnightTourTimers(state);
  const ranked = knightTourRankings(state);
  const winner = ranked.rankings.find((ranking) => ranking.rank === 1);
  state.gameOver = true;
  state.phase = 'finished';
  state.tiebreak = ranked.tiebreak;
  state.winnerId = ranked.tiebreak === 'zero-draw' ? null : (winner?.playerId ?? null);
  state.finishReason =
    state.playMode === 'solo'
      ? `${baseReason} ${state.scores[state.players[0].id] ?? 0}개 보드를 완주했습니다.`
      : ranked.tiebreak === 'zero-draw'
        ? `${baseReason} 0:0 무승부입니다.`
        : `${baseReason} ${winner?.nickname ?? '플레이어'} 님이 승리했습니다.`;
  void broadcastKnightTourState(io, state);
  const payload = {
    rankings: ranked.rankings,
    totalTurns: state.roundResults.length,
    gameResultData: toKnightTourRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (knightTourStates.get(state.roomId) !== state) return;
    knightTourStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function hasClinched(state: KnightTourState) {
  return (
    state.playMode !== 'solo' && Object.values(state.scores).some((score) => score >= KT_WIN_SCORE)
  );
}

function scheduleRoundTimer(io: IO, state: KnightTourState) {
  if (state.roundSeconds == null) return;
  state.roundTimer = setTimeout(
    () => resolveRound(io, state, null, 'timeout'),
    state.roundSeconds * 1000,
  );
}

function scheduleAiStep(io: IO, state: KnightTourState) {
  if (state.playMode !== 'com' || state.gameOver || state.phase !== 'playing') return;
  state.aiTimer = setTimeout(
    () => {
      if (
        knightTourStates.get(state.roomId) !== state ||
        state.phase !== 'playing' ||
        state.gameOver
      )
        return;
      const solution = state.rounds[state.currentRoundIndex].solution;
      const path = state.paths[AI_PLAYER_ID] ?? [];
      const next = solution[path.length];
      if (!next) return;
      path.push({ ...next });
      void broadcastKnightTourState(io, state);
      if (path.length === solution.length) resolveRound(io, state, AI_PLAYER_ID, 'completed');
      else scheduleAiStep(io, state);
    },
    AI_STEP_MIN_MS + Math.random() * (AI_STEP_MAX_MS - AI_STEP_MIN_MS),
  );
}

function advanceRound(io: IO, state: KnightTourState) {
  if (state.gameOver || knightTourStates.get(state.roomId) !== state) return;
  if (hasClinched(state)) return finishGame(io, state, `${KT_WIN_SCORE}점을 선취했습니다.`);
  if (state.currentRoundIndex + 1 >= state.totalRounds)
    return finishGame(io, state, `${state.totalRounds}라운드가 종료되었습니다.`);
  state.currentRoundIndex += 1;
  state.phase = 'playing';
  state.paths = Object.fromEntries(
    [...new Set(state.players.map((player) => player.id))].map((id) => [id, []]),
  );
  state.roundStartedAt = Date.now();
  state.lastRoundResult = null;
  state.transitionTimer = null;
  void broadcastKnightTourState(io, state);
  scheduleRoundTimer(io, state);
  scheduleAiStep(io, state);
}

function resolveRound(
  io: IO,
  state: KnightTourState,
  winnerId: string | null,
  reason: 'completed' | 'timeout',
) {
  if (state.gameOver || state.phase !== 'playing') return;
  if (state.roundTimer) clearTimeout(state.roundTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.roundTimer = null;
  state.aiTimer = null;
  if (winnerId) state.scores[winnerId] = (state.scores[winnerId] ?? 0) + 1;
  const now = Date.now();
  const round = state.rounds[state.currentRoundIndex];
  const result: KnightTourRoundResult = {
    round: state.currentRoundIndex + 1,
    winnerId,
    reason,
    elapsedMs: winnerId ? Math.max(0, now - state.roundStartedAt) : null,
    matchElapsedMs: winnerId ? Math.max(0, now - state.matchStartedAt) : null,
    winningPath: winnerId ? (state.paths[winnerId] ?? []).map((cell) => ({ ...cell })) : [],
    solution: round.solution.map((cell) => ({ ...cell })),
    scoresAfter: { ...state.scores },
  };
  round.result = result;
  state.roundResults.push(result);
  state.lastRoundResult = result;
  state.phase = 'round-result';
  void broadcastKnightTourState(io, state);
  state.transitionTimer = setTimeout(() => advanceRound(io, state), ROUND_RESULT_MS);
}

function activeCellSet(state: KnightTourState) {
  return new Set(state.rounds[state.currentRoundIndex].board.activeCells.map(knightTourCellKey));
}

function handleMove(io: IO, state: KnightTourState, playerId: string, cell: KnightTourCell) {
  if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) return;
  if (!activeCellSet(state).has(knightTourCellKey(cell))) return;
  const path = state.paths[playerId];
  if (!path || path.some((visited) => knightTourCellKey(visited) === knightTourCellKey(cell)))
    return;
  const current = path.at(-1);
  if (current && !isKnightMove(current, cell)) return;
  path.push({ ...cell });
  void broadcastKnightTourState(io, state);
  if (path.length === state.rounds[state.currentRoundIndex].board.activeCells.length)
    resolveRound(io, state, playerId, 'completed');
}

export function initKnightTour(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  _startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: KnightTourEndGameFn,
) {
  const previous = knightTourStates.get(roomId);
  if (previous) clearKnightTourTimers(previous);
  const first = players[0];
  if (!first) throw new Error('나이트의 여행을 시작할 플레이어가 필요합니다.');
  const second = playMode === 'solo' ? first : players[1];
  if (!second) throw new Error('멀티/COM 모드에는 두 명의 플레이어가 필요합니다.');
  const now = Date.now();
  const uniqueIds = [...new Set([first.id, second.id])];
  const state: KnightTourState = {
    roomId,
    playMode,
    players: [first, second],
    rounds: dealKnightTourRounds(KT_TOTAL_ROUNDS).map((round) => ({ ...round, result: null })),
    currentRoundIndex: 0,
    totalRounds: KT_TOTAL_ROUNDS,
    phase: 'playing',
    scores: Object.fromEntries(uniqueIds.map((id) => [id, 0])),
    paths: Object.fromEntries(uniqueIds.map((id) => [id, []])),
    roundStartedAt: now,
    matchStartedAt: now,
    roundSeconds: playMode === 'multi' ? timeLimitSeconds : null,
    roundResults: [],
    lastRoundResult: null,
    tiebreak: playMode === 'solo' ? 'solo' : 'zero-draw',
    winnerId: null,
    finishReason: null,
    gameOver: false,
    roundTimer: null,
    transitionTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  knightTourStates.set(roomId, state);
  scheduleRoundTimer(io, state);
  scheduleAiStep(io, state);
  void broadcastKnightTourState(io, state);
}

export function handleKnightTourAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = knightTourStates.get(roomId);
  if (!state || state.gameOver || state.phase !== 'playing') return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId) || playerId === AI_PLAYER_ID) return;
  const action = rawData as KnightTourAction;
  if (action.type === 'move')
    return handleMove(io, state, playerId, { row: action.row, col: action.col });
  const path = state.paths[playerId];
  if (!path) return;
  if (action.type === 'backtrack') path.pop();
  else if (action.type === 'reset') path.splice(0);
  else return;
  void broadcastKnightTourState(io, state);
}

export function cleanupKnightTour(roomId: string) {
  const state = knightTourStates.get(roomId);
  if (state) clearKnightTourTimers(state);
  knightTourStates.delete(roomId);
}

export function getKnightTourState(roomId: string) {
  const state = knightTourStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.roundResults.length } : undefined;
}

export function getKnightTourResultData(roomId: string) {
  const state = knightTourStates.get(roomId);
  return state ? toKnightTourRecord(state) : undefined;
}

export function performKnightTourUndo() {
  return false;
}
export function canKnightTourUndo() {
  return false;
}
export { emitKnightTourStateToSocket };
