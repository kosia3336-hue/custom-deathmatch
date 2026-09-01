import {
  DOUBLE_SIDED_POKER_ANTE,
  DOUBLE_SIDED_POKER_INITIAL_CHIPS,
} from '@shared/types/double-sided-poker.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { shuffleDoubleSidedPokerDeck } from './deck.js';
import { beginDoubleSidedPokerRound, performDoubleSidedPokerAction } from './engine.js';
import {
  clearDoubleSidedPokerTimers,
  doubleSidedPokerStates,
  emitDoubleSidedPokerStateToSocket,
  toDoubleSidedPokerRecord,
} from './state.js';
import type { DoubleSidedPokerEndGameFn, DoubleSidedPokerState } from './types.js';

export function initDoubleSidedPoker(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: DoubleSidedPokerEndGameFn,
) {
  const previous = doubleSidedPokerStates.get(roomId);
  if (previous) clearDoubleSidedPokerTimers(previous);
  doubleSidedPokerStates.delete(roomId);
  if (playMode !== 'multi' && playMode !== 'com') {
    throw new Error('양면포커는 멀티 또는 COM 모드에서 플레이할 수 있습니다.');
  }
  const first = players[0];
  const second = players[1];
  if (!first || !second) throw new Error('양면포커에는 두 명의 플레이어가 필요합니다.');

  const state: DoubleSidedPokerState = {
    roomId,
    playMode,
    players: [first, second],
    playerStates: {
      [first.id]: {
        chips: DOUBLE_SIDED_POKER_INITIAL_CHIPS,
        card: null,
        selection: null,
        stake: 0,
        frontBet: 0,
        backBet: 0,
      },
      [second.id]: {
        chips: DOUBLE_SIDED_POKER_INITIAL_CHIPS,
        card: null,
        selection: null,
        stake: 0,
        frontBet: 0,
        backBet: 0,
      },
    },
    phase: 'betting',
    round: 1,
    ante: DOUBLE_SIDED_POKER_ANTE,
    carryRound: false,
    pot: 0,
    deck: shuffleDoubleSidedPokerDeck(),
    deckCycles: 1,
    firstPlayerId: first.id,
    currentTurnId: first.id,
    bettingOpened: false,
    doubleBettorId: null,
    roundActions: [],
    roundResults: [],
    lastRoundResult: null,
    startedAt,
    roundStartedAt: startedAt,
    turnStartedAt: startedAt,
    turnSeconds: timeLimitSeconds,
    winnerId: null,
    finishReason: null,
    gameOver: false,
    turnTimer: null,
    transitionTimer: null,
    aiTimer: null,
    finishTimer: null,
    endGameCallback,
  };
  doubleSidedPokerStates.set(roomId, state);
  beginDoubleSidedPokerRound(io, state);
}

export function handleDoubleSidedPokerAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = doubleSidedPokerStates.get(roomId);
  if (!state || state.gameOver) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId) || playerId === AI_PLAYER_ID) return;
  const error = performDoubleSidedPokerAction(io, state, playerId, rawData);
  if (error) socket.emit('error', { message: error });
}

export function cleanupDoubleSidedPoker(roomId: string) {
  const state = doubleSidedPokerStates.get(roomId);
  if (state) clearDoubleSidedPokerTimers(state);
  doubleSidedPokerStates.delete(roomId);
}

export function getDoubleSidedPokerState(roomId: string) {
  const state = doubleSidedPokerStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.roundResults.length } : undefined;
}

export function getDoubleSidedPokerResultData(roomId: string) {
  const state = doubleSidedPokerStates.get(roomId);
  return state ? toDoubleSidedPokerRecord(state) : undefined;
}

export function performDoubleSidedPokerUndo(): boolean {
  return false;
}

export function canDoubleSidedPokerUndo(): boolean {
  return false;
}

export { emitDoubleSidedPokerStateToSocket };
