/** 수식완성N — 동시 선착순 수식 제출, 7라운드 서버 모듈. */
import type { Player, PlayMode } from '@shared/types/room.js';
import {
  FC_DEFAULT_NUMBER_COUNT,
  FC_MAX_NUMBER_COUNT,
  FC_MIN_NUMBER_COUNT,
  FC_REVEAL_MS,
  FC_TOTAL_ROUNDS,
  FC_WIN_SCORE,
  type FormulaCompletionAction,
  type FormulaCompletionRoundResult,
} from '@shared/types/formula-completion.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { FC_FINISH_DISPLAY_MS, FC_MAX_EXPRESSION_LENGTH } from './constants.js';
import { judgeExpression } from './expression.js';
import { generatePuzzle } from './generator.js';
import {
  broadcastFormulaCompletionState,
  clearFormulaCompletionTimers,
  emitFormulaCompletionStateToSocket,
  formulaCompletionStates,
  toFormulaCompletionRecord,
} from './state.js';
import type { EndGameFn, FormulaCompletionState } from './types.js';

function resolveNumberCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return FC_DEFAULT_NUMBER_COUNT;
  return Math.min(FC_MAX_NUMBER_COUNT, Math.max(FC_MIN_NUMBER_COUNT, value));
}

function dealRound(s: FormulaCompletionState) {
  const puzzle = generatePuzzle(s.numberCount, s.usedPuzzleKeys);
  s.usedPuzzleKeys.add(puzzle.key);
  s.numbers = puzzle.numbers;
  s.target = puzzle.target;
  s.solution = puzzle.solution;
  s.phase = 'playing';
  s.lastResult = null;
  s.roundStartedAt = Date.now();
}

function startRoundTimer(io: IO, s: FormulaCompletionState) {
  if (s.roundTimer) clearTimeout(s.roundTimer);
  s.roundTimer = null;
  if (s.roundSeconds == null) return;
  const roundAtStart = s.round;
  s.roundTimer = setTimeout(() => {
    const current = formulaCompletionStates.get(s.roomId);
    if (current !== s || s.gameOver || s.phase !== 'playing' || s.round !== roundAtStart) return;
    endRound(io, s, null, null, null, 'timeout', '제한시간이 끝났습니다.');
  }, s.roundSeconds * 1000);
}

function rankingsFor(s: FormulaCompletionState) {
  const [first, second] = s.players;
  const firstScore = s.scores[first.id] ?? 0;
  if (s.playMode === 'solo') {
    return [{ playerId: first.id, nickname: first.nickname, rank: 1, score: firstScore }];
  }
  const secondScore = s.scores[second.id] ?? 0;
  if (firstScore === secondScore) {
    return [
      { playerId: first.id, nickname: first.nickname, rank: 1, score: firstScore },
      { playerId: second.id, nickname: second.nickname, rank: 1, score: secondScore },
    ];
  }
  const winner = firstScore > secondScore ? first : second;
  const loser = winner.id === first.id ? second : first;
  return [
    { playerId: winner.id, nickname: winner.nickname, rank: 1, score: s.scores[winner.id] ?? 0 },
    { playerId: loser.id, nickname: loser.nickname, rank: 2, score: s.scores[loser.id] ?? 0 },
  ];
}

function hasClinchedMatch(s: FormulaCompletionState) {
  return s.playMode !== 'solo' && Object.values(s.scores).some((score) => score >= FC_WIN_SCORE);
}

function finishGame(io: IO, s: FormulaCompletionState) {
  clearFormulaCompletionTimers(s);
  s.phase = 'finished';
  s.gameOver = true;
  void broadcastFormulaCompletionState(io, s);

  const payload = {
    rankings: rankingsFor(s),
    totalTurns: s.history.length,
    gameResultData: toFormulaCompletionRecord(s),
  };

  s.transitionTimer = setTimeout(() => {
    if (formulaCompletionStates.get(s.roomId) !== s) return;
    formulaCompletionStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, FC_FINISH_DISPLAY_MS);
}

function endRound(
  io: IO,
  s: FormulaCompletionState,
  callerId: string | null,
  expression: string | null,
  evaluatedValue: string | null,
  outcome: 'correct' | 'wrong' | 'timeout',
  reason: string,
) {
  if (s.gameOver || s.phase !== 'playing') return;
  if (s.roundTimer) clearTimeout(s.roundTimer);
  s.roundTimer = null;

  const scoreDelta = callerId == null ? 0 : outcome === 'correct' ? 1 : -1;
  if (callerId) s.scores[callerId] = (s.scores[callerId] ?? 0) + scoreDelta;

  const result: FormulaCompletionRoundResult = {
    round: s.round,
    numbers: [...s.numbers],
    target: s.target,
    outcome,
    callerId,
    expression,
    evaluatedValue,
    scoreDelta,
    scoresAfter: { ...s.scores },
    solution: s.solution,
    reason,
    elapsedMs: callerId ? Date.now() - s.roundStartedAt : null,
  };
  s.history.push(result);
  s.lastResult = result;
  s.phase = 'reveal';
  void broadcastFormulaCompletionState(io, s);

  s.transitionTimer = setTimeout(() => {
    if (formulaCompletionStates.get(s.roomId) !== s || s.gameOver) return;
    if (hasClinchedMatch(s) || s.round >= FC_TOTAL_ROUNDS) {
      finishGame(io, s);
      return;
    }
    s.round++;
    dealRound(s);
    startRoundTimer(io, s);
    void broadcastFormulaCompletionState(io, s);
  }, FC_REVEAL_MS);
}

export function initFormulaCompletion(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
  gameOptions: Record<string, unknown> = {},
) {
  const previous = formulaCompletionStates.get(roomId);
  if (previous) clearFormulaCompletionTimers(previous);
  formulaCompletionStates.delete(roomId);

  const firstPlayer = players[0];
  if (!firstPlayer) throw new Error('수식완성N을 시작할 플레이어가 필요합니다.');
  const secondPlayer = playMode === 'solo' ? firstPlayer : players[1];
  if (!secondPlayer) throw new Error('멀티 수식완성N은 두 명의 플레이어가 필요합니다.');
  const numberCount = resolveNumberCount(gameOptions.numberCount);
  const s: FormulaCompletionState = {
    roomId,
    playMode,
    players: [firstPlayer, secondPlayer],
    phase: 'playing',
    round: 1,
    numberCount,
    numbers: [],
    target: 0,
    solution: '',
    usedPuzzleKeys: new Set(),
    scores: { [firstPlayer.id]: 0, [secondPlayer.id]: 0 },
    history: [],
    lastResult: null,
    roundStartedAt: Date.now(),
    roundSeconds: timeLimitSeconds,
    startedAt,
    gameOver: false,
    roundTimer: null,
    transitionTimer: null,
    endGameCallback,
  };
  dealRound(s);
  formulaCompletionStates.set(roomId, s);
  startRoundTimer(io, s);
  void broadcastFormulaCompletionState(io, s);
}

export function handleFormulaCompletionAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = formulaCompletionStates.get(roomId);
  if (!s || s.gameOver || s.phase !== 'playing') return;

  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!s.players.some((player) => player.id === playerId)) return;

  const action = data as FormulaCompletionAction;
  if (action.type !== 'submit') return;
  const expression = String(action.expression ?? '').trim();
  if (!expression) {
    socket.emit('error', { message: '수식을 입력해 주세요.' });
    return;
  }
  if (expression.length > FC_MAX_EXPRESSION_LENGTH) {
    socket.emit('error', { message: '수식이 너무 깁니다.' });
    return;
  }

  const judgement = judgeExpression(expression, s.numbers, s.target);
  endRound(
    io,
    s,
    playerId,
    judgement.normalizedExpression,
    judgement.evaluatedValue,
    judgement.correct ? 'correct' : 'wrong',
    judgement.reason,
  );
}

export function cleanupFormulaCompletion(roomId: string) {
  const s = formulaCompletionStates.get(roomId);
  if (s) clearFormulaCompletionTimers(s);
  formulaCompletionStates.delete(roomId);
}

export function getFormulaCompletionState(roomId: string) {
  const s = formulaCompletionStates.get(roomId);
  return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
}

export { emitFormulaCompletionStateToSocket };

export function performFormulaCompletionUndo(): boolean {
  return false;
}

export function canFormulaCompletionUndo(): boolean {
  return false;
}

export function getFormulaCompletionResultData(roomId: string): unknown {
  const s = formulaCompletionStates.get(roomId);
  return s ? toFormulaCompletionRecord(s) : undefined;
}
