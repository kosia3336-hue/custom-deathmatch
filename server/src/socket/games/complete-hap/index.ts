import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import {
  CH_MATCH_SECONDS,
  type CompleteHapAction,
  type CompleteHapClaim,
  type CompleteHapTiebreak,
} from '@shared/types/complete-hap.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { completeHapSetKey, dealCompleteHapBoards } from './generator.js';
import {
  broadcastCompleteHapState,
  clearCompleteHapTimers,
  completeHapStates,
  emitCompleteHapStateToSocket,
  toCompleteHapRecord,
} from './state.js';
import type { CompleteHapEndGameFn, CompleteHapState } from './types.js';

const FINISH_DISPLAY_MS = 3000;
const AI_MIN_DELAY_MS = 3500;
const AI_MAX_DELAY_MS = 9000;

function claimStats(state: CompleteHapState, playerId: string) {
  const claims = state.claims.filter((claim) => claim.playerId === playerId);
  const lastClaim = claims.at(-1);
  return {
    reachedAt: lastClaim?.elapsedMs ?? Number.POSITIVE_INFINITY,
    totalElapsed: claims.reduce((sum, claim) => sum + claim.elapsedMs, 0),
    reachedOrder: lastClaim ? state.claims.indexOf(lastClaim) : Number.POSITIVE_INFINITY,
  };
}

export function completeHapRankings(state: CompleteHapState): {
  rankings: { playerId: string; nickname: string; rank: number; score: number }[];
  tiebreak: CompleteHapTiebreak;
} {
  const [first, second] = state.players;
  const firstCount = state.correctCounts[first.id] ?? 0;
  if (state.playMode === 'solo') {
    return {
      rankings: [{ playerId: first.id, nickname: first.nickname, rank: 1, score: firstCount }],
      tiebreak: 'solo',
    };
  }

  const secondCount = state.correctCounts[second.id] ?? 0;
  if (firstCount === 0 && secondCount === 0) {
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
  if (firstCount !== secondCount) {
    winner = firstCount > secondCount ? first : second;
    loser = winner.id === first.id ? second : first;
  } else {
    tiebreak = 'speed';
    const firstStats = claimStats(state, first.id);
    const secondStats = claimStats(state, second.id);
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
        score: state.correctCounts[winner.id] ?? 0,
      },
      {
        playerId: loser.id,
        nickname: loser.nickname,
        rank: 2,
        score: state.correctCounts[loser.id] ?? 0,
      },
    ],
    tiebreak,
  };
}

function allAnswersClaimed(state: CompleteHapState) {
  return state.boards.every((board) => board.claimedSetKeys.size >= board.allSetKeys.size);
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
      ? `${baseReason} 정답 ${state.correctCounts[state.players[0].id] ?? 0}개를 찾았습니다.`
      : result.tiebreak === 'zero-draw'
        ? `${baseReason} 0:0 무승부입니다.`
        : `${baseReason} ${winner?.nickname ?? '플레이어'} 님이 승리했습니다.`;
  void broadcastCompleteHapState(io, state);

  const payload = {
    rankings: result.rankings,
    totalTurns: state.claims.length,
    gameResultData: toCompleteHapRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (completeHapStates.get(state.roomId) !== state) return;
    completeHapStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

function remainingAnswers(state: CompleteHapState) {
  return state.boards.flatMap((board, boardIndex) =>
    board.allSets.flatMap((cardIndexes) =>
      board.claimedSetKeys.has(completeHapSetKey(cardIndexes)) ? [] : [{ boardIndex, cardIndexes }],
    ),
  );
}

function claimAnswer(
  io: IO,
  state: CompleteHapState,
  playerId: string,
  boardIndex: number,
  cardIndexes: number[],
) {
  if (state.gameOver || state.phase !== 'playing') return false;
  const board = state.boards[boardIndex];
  if (!board) return false;
  const sorted = [...cardIndexes].sort((a, b) => a - b);
  const key = completeHapSetKey(sorted);
  if (!board.allSetKeys.has(key) || board.claimedSetKeys.has(key)) return false;

  const claim: CompleteHapClaim = {
    boardIndex,
    cardIndexes: sorted,
    playerId,
    elapsedMs: Math.max(0, Date.now() - state.matchStartedAt),
  };
  board.claimedSetKeys.add(key);
  board.claims.push(claim);
  state.correctCounts[playerId] = (state.correctCounts[playerId] ?? 0) + 1;
  state.claims.push(claim);
  state.lastClaim = claim;
  void broadcastCompleteHapState(io, state);

  if (allAnswersClaimed(state)) {
    finishGame(io, state, '모든 합이 선점되었습니다.');
  }
  return true;
}

function scheduleAi(io: IO, state: CompleteHapState) {
  if (state.playMode !== 'com' || state.gameOver || state.phase !== 'playing') return;
  const delay = AI_MIN_DELAY_MS + Math.random() * (AI_MAX_DELAY_MS - AI_MIN_DELAY_MS);
  state.aiTimer = setTimeout(() => {
    if (completeHapStates.get(state.roomId) !== state || state.gameOver) return;
    const answers = remainingAnswers(state);
    if (answers.length === 0) {
      finishGame(io, state, '모든 합이 선점되었습니다.');
      return;
    }
    const answer = answers[Math.floor(Math.random() * answers.length)];
    claimAnswer(io, state, AI_PLAYER_ID, answer.boardIndex, answer.cardIndexes);
    if (!state.gameOver) scheduleAi(io, state);
  }, delay);
}

export function initCompleteHap(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  _startedAt: number,
  _timeLimitSeconds: number | null,
  endGameCallback: CompleteHapEndGameFn,
) {
  const previous = completeHapStates.get(roomId);
  if (previous) clearCompleteHapTimers(previous);
  completeHapStates.delete(roomId);

  const first = players[0];
  if (!first) throw new Error('컴플릿 합!을 시작할 플레이어가 필요합니다.');
  const second = playMode === 'solo' ? first : players[1];
  if (!second) throw new Error('멀티/COM 모드에는 두 명의 플레이어가 필요합니다.');
  const matchStartedAt = Date.now();
  const state: CompleteHapState = {
    roomId,
    playMode,
    players: [first, second],
    boards: dealCompleteHapBoards(),
    phase: 'playing',
    correctCounts: { [first.id]: 0, [second.id]: 0 },
    matchStartedAt,
    claims: [],
    lastClaim: null,
    tiebreak: playMode === 'solo' ? 'solo' : 'zero-draw',
    winnerId: null,
    finishReason: null,
    gameOver: false,
    matchTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  completeHapStates.set(roomId, state);
  state.matchTimer = setTimeout(() => {
    if (completeHapStates.get(roomId) !== state || state.gameOver) return;
    finishGame(io, state, '10분 제한 시간이 종료되었습니다.');
  }, CH_MATCH_SECONDS * 1000);
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
  if (action.type !== 'submit-hap') return;
  const boardIndex = Number(action.boardIndex);
  const cardIndexes = Array.isArray(action.cardIndexes) ? action.cardIndexes.map(Number) : [];
  const validSelection =
    Number.isInteger(boardIndex) &&
    boardIndex >= 0 &&
    boardIndex < state.boards.length &&
    cardIndexes.length === 3 &&
    new Set(cardIndexes).size === 3 &&
    cardIndexes.every(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < state.boards[boardIndex].cards.length,
    );
  if (!validSelection) {
    socket.emit('error', { message: '같은 문제에서 카드 3장을 선택해 주세요.' });
    return;
  }

  const key = completeHapSetKey(cardIndexes);
  const board = state.boards[boardIndex];
  if (board.claimedSetKeys.has(key)) {
    socket.emit('error', { message: '이미 다른 플레이어가 선점한 합입니다.' });
    return;
  }
  if (!board.allSetKeys.has(key)) {
    socket.emit('error', { message: '선택한 세 카드는 합이 아닙니다. 다시 찾아보세요.' });
    return;
  }
  claimAnswer(io, state, playerId, boardIndex, cardIndexes);
}

export function cleanupCompleteHap(roomId: string) {
  const state = completeHapStates.get(roomId);
  if (state) clearCompleteHapTimers(state);
  completeHapStates.delete(roomId);
}

export function getCompleteHapState(roomId: string) {
  const state = completeHapStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.claims.length } : undefined;
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
