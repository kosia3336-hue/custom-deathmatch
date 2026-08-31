import {
  CHOICE_HOLDEM_INITIAL_CHIPS,
  type ChoiceHoldemAction,
} from '@shared/types/choice-holdem.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { beginChoiceHoldemRound, performChoiceHoldemAction } from './engine.js';
import {
  choiceHoldemStates,
  clearChoiceHoldemTimers,
  emitChoiceHoldemStateToSocket,
  toChoiceHoldemRecord,
} from './state.js';
import type { ChoiceHoldemEndGameFn, ChoiceHoldemState } from './types.js';

export function initChoiceHoldem(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: ChoiceHoldemEndGameFn,
) {
  const previous = choiceHoldemStates.get(roomId);
  if (previous) clearChoiceHoldemTimers(previous);
  choiceHoldemStates.delete(roomId);
  if (playMode !== 'multi' && playMode !== 'com') {
    throw new Error('초이스 홀덤은 멀티 또는 COM 모드에서 플레이할 수 있습니다.');
  }
  const first = players[0];
  const second = players[1];
  if (!first || !second) throw new Error('초이스 홀덤에는 두 명의 플레이어가 필요합니다.');

  const state: ChoiceHoldemState = {
    roomId,
    playMode,
    players: [first, second],
    playerStates: {
      [first.id]: { chips: CHOICE_HOLDEM_INITIAL_CHIPS, roundBet: 0, cards: [] },
      [second.id]: { chips: CHOICE_HOLDEM_INITIAL_CHIPS, roundBet: 0, cards: [] },
    },
    phase: 'first-betting',
    round: 1,
    ante: 1,
    carryRound: false,
    pot: 0,
    communityCards: [],
    choiceCards: [1, 1],
    faceUpIndex: null,
    faceUpOwnerId: null,
    faceDownOwnerId: null,
    firstPlayerId: first.id,
    currentTurnId: first.id,
    actedSinceRaise: new Set(),
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
  choiceHoldemStates.set(roomId, state);
  beginChoiceHoldemRound(io, state);
}

export function handleChoiceHoldemAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = choiceHoldemStates.get(roomId);
  if (!state || state.gameOver) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId) || playerId === AI_PLAYER_ID) return;
  const action = rawData as ChoiceHoldemAction;
  const error = performChoiceHoldemAction(io, state, playerId, action);
  if (error) socket.emit('error', { message: error });
}

export function cleanupChoiceHoldem(roomId: string) {
  const state = choiceHoldemStates.get(roomId);
  if (state) clearChoiceHoldemTimers(state);
  choiceHoldemStates.delete(roomId);
}

export function getChoiceHoldemState(roomId: string) {
  const state = choiceHoldemStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.roundResults.length } : undefined;
}

export function getChoiceHoldemResultData(roomId: string) {
  const state = choiceHoldemStates.get(roomId);
  return state ? toChoiceHoldemRecord(state) : undefined;
}

export function performChoiceHoldemUndo(): boolean {
  return false;
}

export function canChoiceHoldemUndo(): boolean {
  return false;
}

export { emitChoiceHoldemStateToSocket };
