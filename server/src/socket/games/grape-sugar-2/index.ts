import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { GS2Action, GS2CardId } from '@shared/types/grape-sugar-2.js';
import { CARD_IDS, GS2_TOTAL_ROUNDS } from '@shared/types/grape-sugar-2.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, GS2InternalState } from './types.js';
import {
  gameStates, broadcastState, emitStateToSocket, clearAllTimers,
  startRound, makePlayer, performGS2Undo, trySubmit, tryCancelSubmit,
  tryNextRoundReady, resetTimeout,
} from './state.js';
import { handleAiTurn } from './ai.js';

export type { EndGameFn };
export { performGS2Undo };

export function initGrapeSugar2(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearAllTimers(prev);
  gameStates.delete(roomId);

  const p1 = makePlayer(players[0].id, players[0].nickname, 'p1', players[0].id === AI_PLAYER_ID);
  const p2 = makePlayer(players[1].id, players[1].nickname, 'p2', players[1].id === AI_PLAYER_ID);

  const s: GS2InternalState = {
    endGameCallback,
    roomId,
    phase: 'input',
    round: 1,
    maxRound: GS2_TOTAL_ROUNDS,
    extension: 0,
    player1: p1,
    player2: p2,
    history: [],
    stages: [],
    stageStartScores: { p1: 0, p2: 0 },
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

export function handleGrapeSugar2Action(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const action = data as GS2Action;
  if (!action || typeof action !== 'object') return;

  switch (action.type) {
    case 'submit': {
      const card = action.card as GS2CardId;
      const sugar = Number(action.sugar);
      if (!CARD_IDS.includes(card)) {
        socket.emit('error', { message: '올바른 카드가 아닙니다.' });
        return;
      }
      resetTimeout(s, myId);
      const err = trySubmit(io, s, myId, card, sugar);
      if (err) socket.emit('error', { message: err });
      return;
    }
    case 'cancelSubmit': {
      const err = tryCancelSubmit(io, s, myId);
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

export function cleanupGrapeSugar2(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearAllTimers(s);
  gameStates.delete(roomId);
}

export function getGrapeSugar2State(roomId: string) {
  return gameStates.get(roomId);
}

export function emitGrapeSugar2StateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function canGrapeSugar2Undo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  return s.undoSnapshots.length >= 1;
}

export { getGrapeSugar2ResultData } from './state.js';

/**
 * 더미용 공개 뷰. 잔여 카드는 UI와 같이 공개.
 * 이번 라운드 pending 카드/설탕 · dbg opponentPending 금지.
 */
export function getGrapeSugar2DummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  const winner =
    s.finalWinner === 'p1' ? s.player1.id
    : s.finalWinner === 'p2' ? s.player2.id
    : s.finalWinner === 'tie' ? 'tie'
    : null;

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    maxRound: s.maxRound,
    extension: s.extension,
    myId: me.id,
    oppId: opp.id,
    mySide: me.side,
    my: {
      score: me.score,
      sugarRemain: me.sugarRemain,
      hand: [...me.hand],
      submitted: me.submitted,
      hrPenaltyPending: me.hrPenaltyPending,
    },
    opp: {
      score: opp.score,
      sugarRemain: opp.sugarRemain,
      hand: [...opp.hand],
      submitted: opp.submitted,
      hrPenaltyPending: opp.hrPenaltyPending,
    },
    breathAvailable: !(s.player1.breathUsed || s.player2.breathUsed),
    history: s.history.map((r) => ({ ...r, steps: [...r.steps] })),
    winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}
