import type { IO } from './constants.js';
import { REVEAL_DELAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { InternalState } from './types.js';
import { gameStates } from './store.js';
import { broadcastState } from './broadcast.js';
import { pushUndoSnapshot, applyBRPSUndoSnapshot } from './snapshots.js';
import { clearRoundTimer, clearGameTimers, armRoundTimer, scheduleTransition } from './timers.js';
import { settleRound } from './settlement.js';
import { getChoiceRightId, assignRoles } from './players.js';

export { gameStates } from './store.js';
export { broadcastState, emitStateToSocket } from './broadcast.js';
export { clearRoundTimer, clearGameTimers } from './timers.js';
export { getPlayer, getOpponent, makePlayer, assignRoles, getChoiceRightId } from './players.js';

export function startRoundTimer(io: IO, s: InternalState) {
  pushUndoSnapshot(s);
  armRoundTimer(s, () => handleTimeout(io, s));
}

export function performBettingRpsUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'roleSelect';
  if (s.undoSnapshots.length < (partial ? 1 : 2)) return false;
  s.aiGeneration++;
  clearGameTimers(s);
  if (!partial) s.undoSnapshots.pop();
  applyBRPSUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  s.revealEndsAt = null;
  s.finishedEndsAt = null;
  armRoundTimer(s, () => handleTimeout(io, s));
  broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
  return true;
}

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver || (s.phase !== 'roleSelect' && s.phase !== 'submit')) return;
  clearRoundTimer(s);

  // roleSelect 페이즈 타임아웃: 랜덤 역할 배정 후 submit 진행
  if (s.phase === 'roleSelect') {
    const choiceId = getChoiceRightId(s);
    const role = Math.random() < 0.5 ? 'match' : 'bet';
    assignRoles(s, choiceId, role as 'match' | 'bet');
    s.phase = 'submit';
    broadcastState(io, s);
    // 시간 초과로 submit까지 처리
    autoSubmitAll(s);
    processRound(io, s);
    return;
  }

  // submit 페이즈 타임아웃
  const p1Done = s.player1.submitted;
  const p2Done = s.player2.submitted;

  if (!p1Done && !p2Done) {
    autoSubmitAll(s);
    processRound(io, s);
    return;
  }

  if (p1Done && p2Done) {
    processRound(io, s);
    return;
  }

  const winnerId = p1Done ? s.player1.id : s.player2.id;
  resolveGame(io, s, winnerId, 'timeout');
}

function autoSubmitAll(s: InternalState) {
  for (const p of [s.player1, s.player2]) {
    if (p.submitted) continue;
    if (p.role === 'match') {
      const results: Array<'win' | 'draw' | 'lose'> = ['win', 'draw', 'lose'];
      p.matchResult = results[Math.floor(Math.random() * 3)];
      p.submitted = true;
    } else if (p.role === 'bet') {
      const results: Array<'win' | 'draw' | 'lose'> = ['win', 'draw', 'lose'];
      p.prediction = results[Math.floor(Math.random() * 3)];
      p.betChips = 0;
      p.submitted = true;
    }
  }
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
  const payload = {
    rankings: [s.player1, s.player2]
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        rank: winnerId === null || winnerId === p.id ? 1 : 2,
        score: p.chips,
      }))
      .sort((a, b) => a.rank - b.rank),
    totalTurns: s.round,
    gameResultData: getBettingRpsResultData(s.roomId),
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
  scheduleTransition(s, REVEAL_DELAY_MS, () => {
    if (s.round >= s.totalRounds) {
      const p1 = s.player1;
      const p2 = s.player2;
      resolveGame(
        io,
        s,
        p1.chips === p2.chips ? null : p1.chips > p2.chips ? p1.id : p2.id,
        p1.chips === p2.chips ? 'draw' : 'chips',
      );
    } else advanceRound(io, s);
  });
}

export function advanceRound(io: IO, s: InternalState) {
  if (gameStates.get(s.roomId) !== s || s.gameOver) return;
  clearGameTimers(s);
  s.round++;
  s.phase = 'roleSelect';
  s.revealEndsAt = null;
  s.finishedEndsAt = null;
  for (const p of [s.player1, s.player2]) {
    p.role = null;
    p.submitted = false;
    p.matchResult = null;
    p.prediction = null;
    p.betChips = null;
    p.hasChoiceRight = getChoiceRightId(s) === p.id;
  }
  startRoundTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

export function getBettingRpsResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  const p1 = s.player1;
  const p2 = s.player2;
  return {
    winType: s.winType,
    finalChips: { [p1.id]: p1.chips, [p2.id]: p2.chips },
    totalRounds: s.round,
    actions: s.actionLog,
    players: {
      [p1.id]: { nickname: p1.nickname },
      [p2.id]: { nickname: p2.nickname },
    },
  };
}
