import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { SMS2Action, SMS2Side } from '@shared/types/sun-moon-star-2.js';
import { SMS2_MAX_ROUNDS, powderStageOf } from '@shared/types/sun-moon-star-2.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, SMS2InternalState } from './types.js';
import {
  gameStates, broadcastState, emitStateToSocket, clearAllTimers,
  startRound, makePlayer, makeMarkPool, trySubmitPowder, tryCancelPowder,
  trySubmitBet, tryCancelBet, tryNextRoundReady, resetTimeout, performSMS2Undo,
} from './state.js';
import { handleAiTurn } from './ai.js';

export type { EndGameFn };
export { performSMS2Undo };

function resolveBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

export function initSunMoonStar2(
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

  const firstPlayerSide: SMS2Side = 'p1';

  const enableSuddenDeath = resolveBool(gameOptions?.enableSuddenDeath, false);
  const enableUndo = resolveBool(gameOptions?.enableUndo, true);

  const s: SMS2InternalState = {
    endGameCallback,
    roomId,
    phase: 'powder',
    round: 1,
    maxRound: SMS2_MAX_ROUNDS,
    suddenDeath: false,
    suddenDeathConsumed: false,
    firstPlayerSide,
    player1: p1,
    player2: p2,
    markPool: makeMarkPool(),
    history: [],
    resolveSteps: [],
    resolveTimer: null,
    nextRoundTimer: null,
    lastRoundRecord: null,
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
    options: { enableSuddenDeath, enableUndo },
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

export function handleSunMoonStar2Action(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const action = data as SMS2Action;
  if (!action || typeof action !== 'object') return;

  switch (action.type) {
    case 'submitPowder': {
      resetTimeout(s, myId);
      const err = trySubmitPowder(io, s, myId, action.powder);
      if (err) socket.emit('error', { message: err });
      return;
    }
    case 'cancelPowder': {
      const err = tryCancelPowder(io, s, myId);
      if (err) socket.emit('error', { message: err });
      return;
    }
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
    case 'nextRoundReady': {
      const err = tryNextRoundReady(io, s, myId);
      if (err) socket.emit('error', { message: err });
      return;
    }
    default:
      return;
  }
}

export function cleanupSunMoonStar2(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearAllTimers(s);
  gameStates.delete(roomId);
}

export function getSunMoonStar2State(roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    ...s,
    // game module router wants { gameOver, totalTurns } interface
  };
}

export function emitSunMoonStar2StateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function performSunMoonStar2Undo(io: IO, roomId: string): boolean {
  return performSMS2Undo(io, roomId);
}

export function canSunMoonStar2Undo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (!s.options.enableUndo) return false;
  return s.undoSnapshots.length >= 1;
}

export { getSunMoonStar2ResultData } from './state.js';

/**
 * 더미용 공개 뷰. 상대 정확 빛가루·이번 분배·dbg opponentPrivate 금지.
 * 지난 markTotalsAfter 와 선 publicBet 은 화면과 같이 공개.
 */
export function getSunMoonStar2DummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  const winner =
    s.finalWinner === 'p1' ? s.player1.id
    : s.finalWinner === 'p2' ? s.player2.id
    : s.finalWinner === 'draw' ? 'draw'
    : null;

  const last = s.history.at(-1);
  const leftover = last
    ? { ...last.markTotalsAfter }
    : { sun: 0, moon: 0, star: 0 };
  const oppStageStart = last ? last.stageAfter[opp.side] : 5;

  const history = s.history.map((r) => {
    const powderSubmission = {
      p1: { ...r.powderSubmission.p1 },
      p2: { ...r.powderSubmission.p2 },
    };
    if (me.side !== 'p1') powderSubmission.p1 = { sun: 0, moon: 0, star: 0 };
    if (me.side !== 'p2') powderSubmission.p2 = { sun: 0, moon: 0, star: 0 };
    return { ...r, powderSubmission };
  });

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    maxRound: s.maxRound,
    suddenDeath: s.suddenDeath,
    firstPlayerSide: s.firstPlayerSide,
    myId: me.id,
    oppId: opp.id,
    mySide: me.side,
    my: {
      chips: me.chips,
      powderRemain: me.powderRemain,
      powderStage: powderStageOf(me.powderRemain),
      markContribution: { ...me.markContribution },
      submittedPowder: !!me.pendingPowder,
      betConfirmed: !!me.pendingBet,
      pendingPowder: me.pendingPowder ? { ...me.pendingPowder } : null,
      pendingBet: me.pendingBet ? { ...me.pendingBet } : null,
    },
    opp: {
      chips: opp.chips,
      powderStage: powderStageOf(opp.powderRemain),
      submittedPowder: !!opp.pendingPowder,
      betConfirmed: !!opp.pendingBet,
      publicBet: opp.betConfirmedAt && opp.pendingBet ? { ...opp.pendingBet } : null,
    },
    leftover,
    oppStageStart,
    history,
    winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}
