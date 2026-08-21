import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { BankAction, BankSide } from '@shared/types/bank-game.js';
import { BANK_TOTAL_ROUNDS } from '@shared/types/bank-game.js';
import type { BankAiDifficulty, IO, TypedSocket } from './constants.js';
import type { BankInternalState, EndGameFn } from './types.js';
import {
  gameStates, broadcastState, emitStateToSocket, clearAllTimers,
  startRound, makePlayer, trySubmitBet, tryCancelBet, tryNextRoundReady,
  trySkipReveal, resetTimeout, performBankUndo, buildGameDataForViewer,
} from './state.js';
import { handleAiTurn } from './ai.js';

export type { EndGameFn };
export { performBankUndo };

function resolveBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function resolveDifficulty(v: unknown): BankAiDifficulty {
  if (v === 'easy' || v === 'normal' || v === 'hard') return v;
  return 'normal';
}

export function initBankGame(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
  gameOptions?: Record<string, unknown>,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearAllTimers(prev);
  gameStates.delete(roomId);

  const p1 = makePlayer(players[0].id, players[0].nickname, 'p1', players[0].id === AI_PLAYER_ID);
  const p2 = makePlayer(players[1].id, players[1].nickname, 'p2', players[1].id === AI_PLAYER_ID);

  const firstSide: BankSide = 'p1';

  const enableUndo = resolveBool(gameOptions?.enableUndo, true);
  const aiDifficulty = resolveDifficulty(gameOptions?.aiDifficulty);

  const s: BankInternalState = {
    endGameCallback,
    roomId,
    phase: 'firstSubmit',
    round: 1,
    maxRound: BANK_TOTAL_ROUNDS,
    firstSide,
    player1: p1,
    player2: p2,
    history: [],
    loserAmountTotal: 0,
    resolveSteps: [],
    lastRoundResult: null,
    lastRoundFull: null,
    resolveTimer: null,
    firstRevealTimer: null,
    nextRoundTimer: null,
    roundTimer: null,
    roundDeadline: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    finalWinner: null,
    winType: null,
    finishReason: null,
    playMode,
    gameOver: false,
    options: { enableUndo, aiDifficulty },
    aiGeneration: 0,
    undoSnapshots: [],
    consecutiveTimeouts: { [p1.id]: 0, [p2.id]: 0 },
  };

  if (playMode === 'com') {
    s.onAITurn = (cbIo, cbState) => { void handleAiTurn(cbIo, cbState); };
  }

  gameStates.set(roomId, s);
  startRound(io, s);
  void broadcastState(io, s);
}

export function handleBankGameAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const action = data as BankAction;
  if (!action || typeof action !== 'object') return;

  switch (action.type) {
    case 'submitBet': {
      resetTimeout(s, myId);
      const err = trySubmitBet(io, s, myId, action.bet);
      if (err) socket.emit('error', { message: err });
      return;
    }
    case 'cancelBet': {
      const err = tryCancelBet(io, s, myId);
      if (err) socket.emit('error', { message: err });
      return;
    }
    case 'skipReveal': {
      const err = trySkipReveal(io, s, myId);
      if (err) socket.emit('error', { message: err });
      return;
    }
    case 'nextRoundReady': {
      const err = tryNextRoundReady(io, s, myId);
      if (err) socket.emit('error', { message: err });
      return;
    }
    default:
      return;
  }
}

export function cleanupBankGame(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearAllTimers(s);
  gameStates.delete(roomId);
}

export function getBankGameState(roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return s;
}

export function emitBankGameStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function performBankGameUndo(io: IO, roomId: string): boolean {
  return performBankUndo(io, roomId);
}

export function canBankGameUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (!s.options.enableUndo) return false;
  // 라운드 ≥ 2이고 firstSubmit 시작 직후만 (해당 라운드의 베팅이 아직 없을 때)
  if (s.round < 2) return false;
  if (s.phase !== 'firstSubmit') return false;
  const first = s.firstSide === 'p1' ? s.player1 : s.player2;
  if (first.pendingBet) return false;
  return s.undoSnapshots.length >= 2;
}

export { getBankGameResultData } from './state.js';

/**
 * 더미용 공개 뷰. 상대 권종·잔액·이번 선 금액 금지.
 * 후에게 선 장수(`firstPublicCount`)만 — UI `FirstCountRevealBanner`와 같음.
 */
export function getBankGameDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  const data = buildGameDataForViewer(s, me.side);
  const myInfo = data.players[me.side];
  const oppInfo = data.players[opp.side];
  const firstInfo = data.firstSide === 'p1' ? data.players.p1 : data.players.p2;
  const countVisible =
    data.phase === 'firstReveal'
    || data.phase === 'secondSubmit'
    || data.phase === 'reveal'
    || data.phase === 'roundEnd'
    || data.phase === 'finished';

  const winner =
    s.finalWinner === 'p1' ? s.player1.id
    : s.finalWinner === 'p2' ? s.player2.id
    : s.finalWinner === 'draw' ? 'draw'
    : null;

  return {
    gameOver: s.gameOver,
    phase: data.phase,
    round: data.round,
    maxRound: data.maxRound,
    firstSide: data.firstSide,
    myId: me.id,
    oppId: opp.id,
    mySide: me.side,
    my: {
      score: myInfo.score,
      inventory: myInfo.inventory
        ? { 1000: myInfo.inventory[1000], 3000: myInfo.inventory[3000], 5000: myInfo.inventory[5000], 10000: myInfo.inventory[10000] }
        : { 1000: 0, 3000: 0, 5000: 0, 10000: 0 },
      inventoryCount: myInfo.inventoryCount,
      inventoryAmount: myInfo.inventoryAmount ?? 0,
      betConfirmed: myInfo.betConfirmed,
    },
    opp: {
      score: oppInfo.score,
      inventoryCount: oppInfo.inventoryCount,
      betConfirmed: oppInfo.betConfirmed,
      publicBetCount: oppInfo.publicBetCount,
    },
    firstPublicCount: countVisible ? firstInfo.publicBetCount : null,
    history: data.history,
    loserAmountTotal: data.loserAmountTotal,
    winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}
