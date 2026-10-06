import { REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, IDPlayerInternal } from './types.js';
import { stockTotal } from './judge.js';
import { gameStates } from './store.js';
import { broadcastState } from './broadcast.js';
import { pushUndoSnapshot, applyUndoSnapshot } from './snapshots.js';
import { clearRoundTimer, clearGameTimers, armRoundTimer, scheduleTransition } from './timers.js';
import { settleRound } from './settlement.js';

export { gameStates } from './store.js';
export { broadcastState, emitStateToSocket } from './broadcast.js';
export { clearRoundTimer, clearGameTimers } from './timers.js';

export function startRoundTimer(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armRoundTimer(s, () => handleTimeout(io, s));
}

export function performInvestDonateUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'submit' || s.player1.submitted || s.player2.submitted;
  if (s.undoSnapshots.length < (partial ? 1 : 2)) return false;
  // Validate first: an invalid undo must not cancel the active deadline.
  s.aiGeneration++;
  clearGameTimers(s);
  if (!partial) s.undoSnapshots.pop();
  applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  s.revealEndsAt = null;
  s.finishedEndsAt = null;
  armRoundTimer(s, () => handleTimeout(io, s));
  broadcastState(io, s);
  return true;
}

function autoSubmitDefaults(p: IDPlayerInternal) {
  if (p.submitted) return;
  p.investCoins = { coin50: 0, coin10: 0, coin1: 0 };
  p.donateCoins = { coin50: 0, coin10: 0, coin1: 0 };
  p.submitted = true;
}

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'submit') return;
  if (!s.player1.submitted && !s.player2.submitted) {
    autoSubmitDefaults(s.player1);
    autoSubmitDefaults(s.player2);
    processRound(io, s);
    return;
  }
  resolveGame(io, s, s.player1.submitted ? s.player1.id : s.player2.id, 'timeout');
}

function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string | null,
  winType: InternalState['winType'],
) {
  clearGameTimers(s);
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  s.revealEndsAt = null;
  s.finishedEndsAt = Date.now() + WIN_DISPLAY_MS;
  broadcastState(io, s);
  const players = [s.player1, s.player2];
  const payload = {
    rankings: players
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        rank: winnerId === null || p.id === winnerId ? 1 : 2,
        score: p.score,
      }))
      .sort((a, b) => a.rank - b.rank),
    totalTurns: s.round,
    gameResultData: getInvestDonateResultData(s.roomId),
  };
  scheduleTransition(s, WIN_DISPLAY_MS, () => {
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  });
}

export function processRound(io: IO, s: InternalState) {
  if (
    gameStates.get(s.roomId) !== s ||
    s.gameOver ||
    s.phase !== 'submit' ||
    !s.player1.submitted ||
    !s.player2.submitted
  )
    return;
  clearGameTimers(s);
  settleRound(s);
  s.phase = 'reveal';
  s.revealEndsAt = Date.now() + REVEAL_DELAY_MS;
  broadcastState(io, s);
  // Round result is visible for the same four seconds before any resolution.
  scheduleTransition(s, REVEAL_DELAY_MS, () => {
    const p1 = s.player1;
    const p2 = s.player2;
    if (p1.score === 0 && p2.score === 0) return resolveGame(io, s, null, 'draw');
    if (p1.score === 0 || p2.score === 0)
      return resolveGame(io, s, p1.score === 0 ? p2.id : p1.id, 'elimination');
    if (s.round >= s.totalRounds) {
      if (p1.score !== p2.score)
        return resolveGame(io, s, p1.score > p2.score ? p1.id : p2.id, 'score');
      const c1 = stockTotal(p1.coinStock);
      const c2 = stockTotal(p2.coinStock);
      if (c1 !== c2) return resolveGame(io, s, c1 > c2 ? p1.id : p2.id, 'tiebreaker');
      return resolveGame(io, s, null, 'draw');
    }
    advanceRound(io, s);
  });
}

export function advanceRound(io: IO, s: InternalState) {
  if (gameStates.get(s.roomId) !== s || s.gameOver) return;
  clearGameTimers(s);
  s.round++;
  s.phase = 'submit';
  s.revealEndsAt = null;
  s.finishedEndsAt = null;
  for (const player of [s.player1, s.player2]) {
    player.submitted = false;
    player.investCoins = null;
    player.donateCoins = null;
    player.investBadge = null;
    player.donateBadge = null;
  }
  startRoundTimer(io, s);
  broadcastState(io, s);
}

export function getInvestDonateResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    winType: s.winType,
    finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
    finalCoinStocks: { [s.player1.id]: s.player1.coinStock, [s.player2.id]: s.player2.coinStock },
    totalRounds: s.round,
    actions: s.actionLog,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
  };
}
