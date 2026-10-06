import type { InternalState } from './types.js';
import type { IO } from './constants.js';
import type { InternalRoundRecord, NF4PlayerInternal } from './types.js';
import { TOTAL_ROUNDS, TILES_PER_ROUND, REVEAL_DELAY_MS } from './constants.js';
import { gameStates } from './store.js';
import { broadcastState } from './broadcast.js';
import { judgeNumber, tiebreaker } from './judge.js';
import { clearRoundTimer, clearGameTimers, armRoundTimer, scheduleTransition } from './timers.js';
import { pushUndoSnapshot, applyNF4UndoSnapshot, hasPartialRoundNF4 } from './undo.js';
import { resolveGame } from './result.js';

export function startRoundTimer(io: IO, s: InternalState) {
  clearGameTimers(s);
  pushUndoSnapshot(s);
  armRoundTimer(s, () => handleTimeout(io, s));
}

export function performNumberFourUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.playMode === 'tutorial') return false;

  const partial = hasPartialRoundNF4(s);
  if (s.undoSnapshots.length < (partial ? 1 : 2)) return false;
  s.aiGeneration++;
  clearGameTimers(s);

  if (hasPartialRoundNF4(s)) {
    if (s.undoSnapshots.length < 1) return false;
    applyNF4UndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    armRoundTimer(s, () => handleTimeout(io, s));
    broadcastState(io, s);
    return true;
  }

  if (s.undoSnapshots.length < 2) return false;
  s.undoSnapshots.pop();
  const prev = s.undoSnapshots[s.undoSnapshots.length - 1];
  applyNF4UndoSnapshot(s, prev);
  armRoundTimer(s, () => handleTimeout(io, s));
  broadcastState(io, s);
  return true;
}
function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver) return;
  clearRoundTimer(s);

  // submitted 플래그는 페이즈 전환 시 리셋되므로 현재 페이즈 기준으로 올바르게 동작
  const p1Done = s.player1.submitted;
  const p2Done = s.player2.submitted;

  if (!p1Done && !p2Done) {
    autoSubmitDefaults(s.player1);
    autoSubmitDefaults(s.player2);
    processRound(io, s);
    return;
  }

  const winnerId = p1Done ? s.player1.id : s.player2.id;
  const loserId = p1Done ? s.player2.id : s.player1.id;
  const winnerP = p1Done ? s.player1 : s.player2;
  const loserP = p1Done ? s.player2 : s.player1;

  resolveGame(io, s, winnerId, winnerP.nickname, loserId, loserP.nickname, 'timeout');
}

function autoSubmitDefaults(p: NF4PlayerInternal) {
  if (p.submittedWhite === null) {
    const w = Math.min(4, p.remainingWhite);
    p.submittedWhite = w;
    p.submittedBlack = TILES_PER_ROUND - w;
    if (p.submittedBlack > p.remainingBlack) {
      p.submittedBlack = p.remainingBlack;
      p.submittedWhite = TILES_PER_ROUND - p.submittedBlack;
    }
  }
  if (p.submittedNumber === null) {
    p.submittedNumber = 1;
  }
  p.submitted = true;
}

/* ────────────────────── game resolution ──────────────── */
/** winnerId 가 null 이면 무승부로 끝낸다(승점·넘버 합·잔여 백색이 모두 같은 경우). */
function delayedResolve(
  io: IO,
  s: InternalState,
  winnerId: string | null,
  loserId: string | null,
  winType: InternalState['winType'],
) {
  const winnerP = winnerId ? (winnerId === s.player1.id ? s.player1 : s.player2) : null;
  const loserP = loserId ? (loserId === s.player1.id ? s.player1 : s.player2) : null;
  scheduleTransition(s, REVEAL_DELAY_MS, () => {
    resolveGame(io, s, winnerId, winnerP?.nickname ?? '', loserId, loserP?.nickname ?? '', winType);
  });
}

export function processRound(io: IO, s: InternalState) {
  clearGameTimers(s);

  const p1w = s.player1.submittedWhite!;
  const p1b = s.player1.submittedBlack!;
  const p1n = s.player1.submittedNumber!;
  const p2w = s.player2.submittedWhite!;
  const p2b = s.player2.submittedBlack!;
  const p2n = s.player2.submittedNumber!;

  const j1 = judgeNumber(p1w, p1b, p2w, p2b, p1n);
  const j2 = judgeNumber(p2w, p2b, p1w, p1b, p2n);

  const p1ScoreBefore = s.player1.score;
  const p2ScoreBefore = s.player2.score;

  s.player1.score = Math.max(0, s.player1.score + j1.scoreChange);
  s.player2.score = Math.max(0, s.player2.score + j2.scoreChange);

  s.player1.remainingWhite -= p1w;
  s.player1.remainingBlack -= p1b;
  s.player2.remainingWhite -= p2w;
  s.player2.remainingBlack -= p2b;

  const roundRecord: InternalRoundRecord = {
    round: s.round,
    players: {
      [s.player1.id]: {
        white: p1w,
        black: p1b,
        number: p1n,
        success: j1.success,
        scoreChange: j1.scoreChange,
        scoreAfter: s.player1.score,
      },
      [s.player2.id]: {
        white: p2w,
        black: p2b,
        number: p2n,
        success: j2.success,
        scoreChange: j2.scoreChange,
        scoreAfter: s.player2.score,
      },
    },
  };
  s.roundHistory.push(roundRecord);

  s.actionLog.push({
    round: s.round,
    players: {
      [s.player1.id]: {
        nickname: s.player1.nickname,
        white: p1w,
        black: p1b,
        number: p1n,
        success: j1.success,
        scoreChange: j1.scoreChange,
        scoreBefore: p1ScoreBefore,
        scoreAfter: s.player1.score,
        conditionDetail: j1.conditionDetail,
      },
      [s.player2.id]: {
        nickname: s.player2.nickname,
        white: p2w,
        black: p2b,
        number: p2n,
        success: j2.success,
        scoreChange: j2.scoreChange,
        scoreBefore: p2ScoreBefore,
        scoreAfter: s.player2.score,
        conditionDetail: j2.conditionDetail,
      },
    },
  });

  s.phase = 'reveal';
  s.revealEndsAt = Date.now() + REVEAL_DELAY_MS;
  broadcastState(io, s);

  const p1Dead = s.player1.score === 0;
  const p2Dead = s.player2.score === 0;

  if (p1Dead && p2Dead) {
    const tb = tiebreaker(s);
    s.tiebreakerReason = tb.reason;
    if (!tb.winnerId) {
      delayedResolve(io, s, null, null, 'draw');
      return;
    }
    const loserId = tb.winnerId === s.player1.id ? s.player2.id : s.player1.id;
    delayedResolve(io, s, tb.winnerId, loserId, 'tiebreaker');
    return;
  }

  if (p1Dead) {
    delayedResolve(io, s, s.player2.id, s.player1.id, 'elimination');
    return;
  }

  if (p2Dead) {
    delayedResolve(io, s, s.player1.id, s.player2.id, 'elimination');
    return;
  }

  if (s.round >= TOTAL_ROUNDS) {
    if (s.player1.score !== s.player2.score) {
      const winnerId = s.player1.score > s.player2.score ? s.player1.id : s.player2.id;
      const loserId = winnerId === s.player1.id ? s.player2.id : s.player1.id;
      delayedResolve(io, s, winnerId, loserId, 'score');
    } else {
      const tb = tiebreaker(s);
      s.tiebreakerReason = tb.reason;
      if (!tb.winnerId) {
        delayedResolve(io, s, null, null, 'draw');
      } else {
        const loserId = tb.winnerId === s.player1.id ? s.player2.id : s.player1.id;
        delayedResolve(io, s, tb.winnerId, loserId, 'tiebreaker');
      }
    }
    return;
  }

  scheduleTransition(s, REVEAL_DELAY_MS, () => {
    advanceRound(io, s);
  });
}

/* ────────────────────── round advance ────────────────── */

export function advanceRound(io: IO, s: InternalState) {
  s.round++;
  s.phase = 'submit';
  s.revealEndsAt = null;

  resetSubmissions(s.player1);
  resetSubmissions(s.player2);

  if (s.playMode === 'solo') {
    s.currentSide = 'player1';
  }

  startRoundTimer(io, s);
  broadcastState(io, s);
}

function resetSubmissions(p: NF4PlayerInternal) {
  p.submitted = false;
  p.submittedWhite = null;
  p.submittedBlack = null;
  p.submittedNumber = null;
}
