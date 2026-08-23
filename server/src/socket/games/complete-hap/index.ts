import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import {
  CH_CARDS_PER_BOARD,
  CH_MATCH_SECONDS,
  CH_TOTAL_ROUNDS,
  CH_WIN_SCORE,
  type CompleteHapAction,
  type CompleteHapRoundResult,
  type CompleteHapTiebreak,
} from '@shared/types/complete-hap.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { completeHapSetKey, dealCompleteHapRounds } from './generator.js';
import {
  broadcastCompleteHapState,
  clearCompleteHapTimers,
  completeHapStates,
  emitCompleteHapStateToSocket,
  toCompleteHapRecord,
} from './state.js';
import type { CompleteHapEndGameFn, CompleteHapState } from './types.js';

const ROUND_RESULT_MS = 2500;
const FINISH_DISPLAY_MS = 3000;
const AI_MIN_DELAY_PER_SET_MS = 3500;
const AI_MAX_DELAY_PER_SET_MS = 9000;
const MAX_SET_COMBINATIONS = 84;

function pointStats(state: CompleteHapState, playerId: string) {
  const results = state.roundResults.filter((result) => result.pointPlayerId === playerId);
  const lastResult = results.at(-1);
  return {
    reachedAt: lastResult?.matchElapsedMs ?? Number.POSITIVE_INFINITY,
    totalElapsed: results.reduce((sum, result) => sum + result.matchElapsedMs, 0),
    reachedOrder: lastResult ? state.roundResults.indexOf(lastResult) : Number.POSITIVE_INFINITY,
  };
}

export function completeHapRankings(state: CompleteHapState): {
  rankings: { playerId: string; nickname: string; rank: number; score: number }[];
  tiebreak: CompleteHapTiebreak;
} {
  const [first, second] = state.players;
  const firstScore = state.scores[first.id] ?? 0;
  if (state.playMode === 'solo') {
    return {
      rankings: [{ playerId: first.id, nickname: first.nickname, rank: 1, score: firstScore }],
      tiebreak: 'solo',
    };
  }

  const secondScore = state.scores[second.id] ?? 0;
  if (firstScore === 0 && secondScore === 0) {
    return {
      rankings: [
        { playerId: first.id, nickname: first.nickname, rank: 1, score: 0 },
        { playerId: second.id, nickname: second.nickname, rank: 1, score: 0 },
      ],
      tiebreak: 'zero-draw',
    };
  }

  let winner: Player;
  let loser: Player;
  let tiebreak: CompleteHapTiebreak = 'count';
  if (firstScore !== secondScore) {
    winner = firstScore > secondScore ? first : second;
    loser = winner.id === first.id ? second : first;
  } else {
    tiebreak = 'speed';
    const firstStats = pointStats(state, first.id);
    const secondStats = pointStats(state, second.id);
    const firstWins =
      firstStats.reachedAt !== secondStats.reachedAt
        ? firstStats.reachedAt < secondStats.reachedAt
        : firstStats.totalElapsed !== secondStats.totalElapsed
          ? firstStats.totalElapsed < secondStats.totalElapsed
          : firstStats.reachedOrder <= secondStats.reachedOrder;
    winner = firstWins ? first : second;
    loser = firstWins ? second : first;
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

function formatLimit(seconds: number) {
  if (seconds % 60 === 0) return `${seconds / 60}분`;
  return `${seconds}초`;
}

function finishGame(io: IO, state: CompleteHapState, baseReason: string) {
  if (state.gameOver) return;
  clearCompleteHapTimers(state);
  const result = completeHapRankings(state);
  const winner = result.rankings.find((ranking) => ranking.rank === 1);
  state.gameOver = true;
  state.phase = 'finished';
  state.tiebreak = result.tiebreak;
  state.winnerId = result.tiebreak === 'zero-draw' ? null : (winner?.playerId ?? null);
  state.finishReason =
    state.playMode === 'solo'
      ? `${baseReason} ${state.scores[state.players[0].id] ?? 0}점을 획득했습니다.`
      : result.tiebreak === 'zero-draw'
        ? `${baseReason} 0:0 무승부입니다.`
        : `${baseReason} ${winner?.nickname ?? '플레이어'} 님이 승리했습니다.`;
  void broadcastCompleteHapState(io, state);

  const payload = {
    rankings: result.rankings,
    totalTurns: state.roundResults.length,
    gameResultData: toCompleteHapRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (completeHapStates.get(state.roomId) !== state) return;
    completeHapStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function opponentId(state: CompleteHapState, callerId: string) {
  if (state.playMode === 'solo') return null;
  return state.players.find((player) => player.id !== callerId)?.id ?? null;
}

function hasClinchedMatch(state: CompleteHapState) {
  return (
    state.playMode !== 'solo' && Object.values(state.scores).some((score) => score >= CH_WIN_SCORE)
  );
}

function parseSubmittedSets(value: unknown) {
  if (!Array.isArray(value)) return { sets: [] as number[][], valid: false };
  const rawSets = value.slice(0, MAX_SET_COMBINATIONS + 1);
  let valid = value.length <= MAX_SET_COMBINATIONS;
  const sets = rawSets.map((rawSet) => {
    if (!Array.isArray(rawSet) || rawSet.length !== 3) valid = false;
    const indexes = (Array.isArray(rawSet) ? rawSet.slice(0, 3) : []).map((rawIndex) =>
      typeof rawIndex === 'number' && Number.isInteger(rawIndex) ? rawIndex : -1,
    );
    if (
      indexes.length !== 3 ||
      new Set(indexes).size !== 3 ||
      indexes.some((index) => index < 0 || index >= CH_CARDS_PER_BOARD)
    ) {
      valid = false;
    }
    return indexes.sort((a, b) => a - b);
  });
  const keys = sets.map(completeHapSetKey);
  if (new Set(keys).size !== keys.length) valid = false;
  return { sets, valid };
}

function scheduleAi(io: IO, state: CompleteHapState) {
  if (state.playMode !== 'com' || state.gameOver || state.phase !== 'playing') return;
  const round = state.rounds[state.currentRoundIndex];
  const delayPerSet =
    AI_MIN_DELAY_PER_SET_MS + Math.random() * (AI_MAX_DELAY_PER_SET_MS - AI_MIN_DELAY_PER_SET_MS);
  state.aiTimer = setTimeout(
    () => {
      if (
        completeHapStates.get(state.roomId) !== state ||
        state.gameOver ||
        state.phase !== 'playing'
      ) {
        return;
      }
      resolveGyul(io, state, AI_PLAYER_ID, round.allSets);
    },
    Math.max(AI_MIN_DELAY_PER_SET_MS, round.allSets.length * delayPerSet),
  );
}

function advanceAfterRound(io: IO, state: CompleteHapState) {
  if (state.gameOver || completeHapStates.get(state.roomId) !== state) return;
  if (hasClinchedMatch(state)) {
    finishGame(io, state, `${CH_WIN_SCORE}점을 선취했습니다.`);
    return;
  }
  if (state.currentRoundIndex + 1 >= state.totalRounds) {
    finishGame(io, state, `${state.totalRounds}라운드가 종료되었습니다.`);
    return;
  }
  state.currentRoundIndex += 1;
  state.phase = 'playing';
  state.roundStartedAt = Date.now();
  state.lastRoundResult = null;
  state.roundTimer = null;
  void broadcastCompleteHapState(io, state);
  scheduleAi(io, state);
}

function resolveGyul(io: IO, state: CompleteHapState, callerId: string, value: unknown) {
  if (state.gameOver || state.phase !== 'playing') return;
  const round = state.rounds[state.currentRoundIndex];
  const submitted = parseSubmittedSets(value);
  const submittedKeys = new Set(submitted.sets.map(completeHapSetKey));
  const correct =
    submitted.valid &&
    submittedKeys.size === round.allSetKeys.size &&
    [...round.allSetKeys].every((key) => submittedKeys.has(key));
  const pointPlayerId = correct ? callerId : opponentId(state, callerId);
  if (pointPlayerId) state.scores[pointPlayerId] = (state.scores[pointPlayerId] ?? 0) + 1;

  const now = Date.now();
  const result: CompleteHapRoundResult = {
    round: state.currentRoundIndex + 1,
    callerId,
    pointPlayerId,
    correct,
    submittedSets: submitted.sets.map((set) => [...set]),
    answerSets: round.allSets.map((set) => [...set]),
    elapsedMs: Math.max(0, now - state.roundStartedAt),
    matchElapsedMs: Math.max(0, now - state.matchStartedAt),
  };
  round.result = result;
  state.roundResults.push(result);
  state.lastRoundResult = result;
  state.phase = 'round-result';
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.aiTimer = null;
  void broadcastCompleteHapState(io, state);
  state.roundTimer = setTimeout(() => advanceAfterRound(io, state), ROUND_RESULT_MS);
}

export function initCompleteHap(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  _startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: CompleteHapEndGameFn,
) {
  const previous = completeHapStates.get(roomId);
  if (previous) clearCompleteHapTimers(previous);
  completeHapStates.delete(roomId);

  const first = players[0];
  if (!first) throw new Error('컴플릿 결! 합!을 시작할 플레이어가 필요합니다.');
  const second = playMode === 'solo' ? first : players[1];
  if (!second) throw new Error('멀티/COM 모드에는 두 명의 플레이어가 필요합니다.');
  const matchStartedAt = Date.now();
  const matchSeconds = playMode === 'multi' ? timeLimitSeconds : CH_MATCH_SECONDS;
  const state: CompleteHapState = {
    roomId,
    playMode,
    players: [first, second],
    rounds: dealCompleteHapRounds(CH_TOTAL_ROUNDS),
    currentRoundIndex: 0,
    totalRounds: CH_TOTAL_ROUNDS,
    phase: 'playing',
    scores: { [first.id]: 0, [second.id]: 0 },
    roundStartedAt: matchStartedAt,
    matchStartedAt,
    matchSeconds,
    roundResults: [],
    lastRoundResult: null,
    tiebreak: playMode === 'solo' ? 'solo' : 'zero-draw',
    winnerId: null,
    finishReason: null,
    gameOver: false,
    matchTimer: null,
    roundTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  completeHapStates.set(roomId, state);
  if (matchSeconds != null) {
    state.matchTimer = setTimeout(() => {
      if (completeHapStates.get(roomId) !== state || state.gameOver) return;
      finishGame(io, state, `${formatLimit(matchSeconds)} 제한 시간이 종료되었습니다.`);
    }, matchSeconds * 1000);
  }
  scheduleAi(io, state);
  void broadcastCompleteHapState(io, state);
}

export function handleCompleteHapAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = completeHapStates.get(roomId);
  if (!state || state.gameOver || state.phase !== 'playing') return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId) || playerId === AI_PLAYER_ID) return;

  const action = rawData as CompleteHapAction;
  if (action.type !== 'call-gyul') return;
  resolveGyul(io, state, playerId, action.sets);
}

export function cleanupCompleteHap(roomId: string) {
  const state = completeHapStates.get(roomId);
  if (state) clearCompleteHapTimers(state);
  completeHapStates.delete(roomId);
}

export function getCompleteHapState(roomId: string) {
  const state = completeHapStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.roundResults.length } : undefined;
}

export function getCompleteHapResultData(roomId: string) {
  const state = completeHapStates.get(roomId);
  return state ? toCompleteHapRecord(state) : undefined;
}

export function performCompleteHapUndo(): boolean {
  return false;
}

export function canCompleteHapUndo(): boolean {
  return false;
}

export { emitCompleteHapStateToSocket };
