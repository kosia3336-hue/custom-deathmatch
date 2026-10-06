import type { IndianPokerAction } from '@shared/types/indian-poker.js';
import { RESULT_DISPLAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, IPPlayerInternal } from './types.js';
import { aiTakeTurn } from './ai.js';
import { gameStates } from './store.js';
import { applySnapshot } from './snapshots.js';
import {
  armTurnTimer as armTimer,
  clearTurnTimer,
  clearGameTimers,
  clearTransitionTimers,
  scheduleTransition,
} from './timers.js';
import { settleShowdown, settleDie } from './settlement.js';
import { checkGameEnd, prepareNextRound } from './rounds.js';
import { broadcastState } from './broadcast.js';
export { broadcastState, emitStateToSocket } from './broadcast.js';
export { gameStates } from './store.js';
export { clearTurnTimer, clearGameTimers } from './timers.js';
export function startTurnTimer(io: IO, s: InternalState) {
  armTurnTimer(io, s);
}
function armTurnTimer(io: IO, s: InternalState) {
  armTimer(io, s, () => handleTimeout(io, s));
}

/* ────────────────────── helpers ──────────────────────── */

function getOpponent(s: InternalState, playerId: string): IPPlayerInternal {
  return playerId === s.player1Id ? s.players[s.player2Id] : s.players[s.player1Id];
}

/* ────────────────────── turn timer ──────────────────── */

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'betting') return;
  clearTurnTimer(s);

  const loserId = s.currentTurnId!;
  const winnerId = loserId === s.player1Id ? s.player2Id : s.player1Id;
  resolveGame(io, s, winnerId, loserId, 'timeout');
}

/* ────────────────────── undo snapshots ───────────── */

export function performIndianPokerUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  const requiredSnapshots = s.playMode === 'com' || s.currentRoundActions.length > 0 ? 1 : 2;
  if (s.undoSnapshots.length < requiredSnapshots) return false;
  clearGameTimers(s);

  if (s.playMode === 'com') {
    // COM 모드: 라운드 시작 시점으로 복원 (AI 턴 + 유저 턴 모두 롤백)
    const snap = s.undoSnapshots[s.undoSnapshots.length - 1];
    applySnapshot(s, snap);
  } else {
    // 멀티: 이번 라운드 중 일부 베팅이 있으면 라운드 시작으로, 아니면 이전 라운드로
    if (s.currentRoundActions.length > 0) {
      applySnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    } else {
      s.undoSnapshots.pop();
      applySnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    }
  }

  armTurnTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }

  return true;
}

/* ────────────────────── game resolution ──────────────── */

function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string,
  loserId: string,
  winType: InternalState['winType'],
) {
  clearTransitionTimers(s);
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  clearTurnTimer(s);
  broadcastState(io, s);

  const winnerP = s.players[winnerId];
  const loserP = s.players[loserId];

  const payload = {
    rankings: [
      { playerId: winnerId, nickname: winnerP.nickname, rank: 1, score: winnerP.chips },
      { playerId: loserId, nickname: loserP.nickname, rank: 2, score: loserP.chips },
    ],
    totalTurns: s.totalBettingActions,
    gameResultData: {
      winType: s.winType,
      finalChips: {
        [s.player1Id]: s.players[s.player1Id].chips,
        [s.player2Id]: s.players[s.player2Id].chips,
      },
      totalRounds: s.round,
      deckCycles: s.deckCycle,
      finalAnte: s.ante,
      initialChips: s.initialChips,
      roundHistory: s.roundHistory,
      players: {
        [s.player1Id]: { nickname: s.players[s.player1Id].nickname },
        [s.player2Id]: { nickname: s.players[s.player2Id].nickname },
      },
    },
  };

  scheduleTransition(s, 'finishTimer', WIN_DISPLAY_MS, () => {
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  });
}

/* ────────────────────── betting processing ───────────── */

export function processBettingAction(
  io: IO,
  s: InternalState,
  playerId: string,
  action: IndianPokerAction,
) {
  const player = s.players[playerId];
  const opponent = getOpponent(s, playerId);

  s.currentRoundActions.push({
    playerId,
    action: action.type,
    amount: action.type === 'raise' ? action.amount : undefined,
  });
  s.totalBettingActions++;

  switch (action.type) {
    case 'check':
      s.currentTurnId = opponent.id;
      break;

    case 'call': {
      const callCost = opponent.roundBet - player.roundBet;
      player.chips -= callCost;
      player.roundBet = opponent.roundBet;
      s.pot += callCost;
      processShowdown(io, s);
      return;
    }

    case 'raise': {
      const amount = action.amount;
      const additionalCost = amount - player.roundBet;
      player.chips -= additionalCost;
      player.roundBet = amount;
      s.pot += additionalCost;
      s.bettingStarted = true;
      s.currentBet = amount;
      s.currentTurnId = opponent.id;
      break;
    }

    case 'die':
      processDie(io, s, playerId);
      return;
  }

  armTurnTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }
}

/* ────────────────────── showdown ─────────────────────── */

function processShowdown(io: IO, s: InternalState) {
  s.phase = 'showdown';
  clearTurnTimer(s);

  settleShowdown(s);
  broadcastState(io, s);
  scheduleNextRound(io, s);
}

/* ────────────────────── die ──────────────────────────── */

function processDie(io: IO, s: InternalState, diedPlayerId: string) {
  s.phase = 'dieResult';
  clearTurnTimer(s);

  settleDie(s, diedPlayerId);
  broadcastState(io, s);
  scheduleNextRound(io, s);
}

/* ────────────────────── record + advance ─────────────── */

function scheduleNextRound(io: IO, s: InternalState) {
  scheduleTransition(s, 'nextRoundTimer', RESULT_DISPLAY_MS, () => advanceRound(io, s));
}

export function advanceRound(io: IO, s: InternalState) {
  // 1. 게임 종료 검사 (칩 0)
  if (checkGameEnd(s)) {
    const loserId = s.winner === s.player1Id ? s.player2Id : s.player1Id;
    resolveGame(io, s, s.winner!, loserId, 'chipOut');
    return;
  }

  prepareNextRound(s);
  // 다음 입력 차례의 시계를 시작한다.
  armTurnTimer(io, s);

  // deckResetOccurred = true 상태로 전송한다.
  broadcastState(io, s);

  // 클라이언트가 수신한 뒤 플래그 해제 (이후 재전송 시 중복 toast 방지)
  s.deckResetOccurred = false;

  // AI 턴
  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }
}

export function getIndianPokerResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    winType: s.winType,
    finalChips: {
      [s.player1Id]: s.players[s.player1Id].chips,
      [s.player2Id]: s.players[s.player2Id].chips,
    },
    totalRounds: s.round,
    deckCycles: s.deckCycle,
    finalAnte: s.ante,
    initialChips: s.initialChips,
    roundHistory: s.roundHistory,
    players: {
      [s.player1Id]: { nickname: s.players[s.player1Id].nickname },
      [s.player2Id]: { nickname: s.players[s.player2Id].nickname },
    },
  };
}
