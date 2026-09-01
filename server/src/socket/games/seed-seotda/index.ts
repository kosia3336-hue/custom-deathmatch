import {
  SEED_SEOTDA_ANTE,
  SEED_SEOTDA_INITIAL_CHIPS,
  type SeedSeotdaAction,
} from '@shared/types/seed-seotda.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import { shuffleSeedSeotdaDeck } from './deck.js';
import { beginSeedSeotdaRound, performSeedSeotdaAction } from './engine.js';
import {
  clearSeedSeotdaTimers,
  emitSeedSeotdaStateToSocket,
  seedSeotdaStates,
  toSeedSeotdaRecord,
} from './state.js';
import type { SeedSeotdaEndGameFn, SeedSeotdaState } from './types.js';

export function initSeedSeotda(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: SeedSeotdaEndGameFn,
) {
  const previous = seedSeotdaStates.get(roomId);
  if (previous) clearSeedSeotdaTimers(previous);
  seedSeotdaStates.delete(roomId);
  if (playMode !== 'multi' && playMode !== 'com') {
    throw new Error('시드섯다는 멀티 또는 COM 모드에서 플레이할 수 있습니다.');
  }
  const first = players[0];
  const second = players[1];
  if (!first || !second) throw new Error('시드섯다에는 두 명의 플레이어가 필요합니다.');

  const state: SeedSeotdaState = {
    roomId,
    playMode,
    players: [first, second],
    playerStates: {
      [first.id]: {
        chips: SEED_SEOTDA_INITIAL_CHIPS,
        roundBet: 0,
        cards: [],
        finalHand: [],
        seedChoice: 'pending',
        discardIndex: null,
      },
      [second.id]: {
        chips: SEED_SEOTDA_INITIAL_CHIPS,
        roundBet: 0,
        cards: [],
        finalHand: [],
        seedChoice: 'pending',
        discardIndex: null,
      },
    },
    phase: 'seed-choice',
    round: 1,
    ante: SEED_SEOTDA_ANTE,
    carryRound: false,
    pot: 0,
    deck: shuffleSeedSeotdaDeck(),
    deckCycles: 1,
    seedCard: null,
    firstPlayerId: first.id,
    currentTurnId: first.id,
    bettingOpened: false,
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
  seedSeotdaStates.set(roomId, state);
  beginSeedSeotdaRound(io, state);
}

export function handleSeedSeotdaAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = seedSeotdaStates.get(roomId);
  if (!state || state.gameOver) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === playerId) || playerId === AI_PLAYER_ID) return;
  const error = performSeedSeotdaAction(io, state, playerId, rawData as SeedSeotdaAction);
  if (error) socket.emit('error', { message: error });
}

export function cleanupSeedSeotda(roomId: string) {
  const state = seedSeotdaStates.get(roomId);
  if (state) clearSeedSeotdaTimers(state);
  seedSeotdaStates.delete(roomId);
}

export function getSeedSeotdaState(roomId: string) {
  const state = seedSeotdaStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.roundResults.length } : undefined;
}

export function getSeedSeotdaResultData(roomId: string) {
  const state = seedSeotdaStates.get(roomId);
  return state ? toSeedSeotdaRecord(state) : undefined;
}

export function performSeedSeotdaUndo(): boolean {
  return false;
}

export function canSeedSeotdaUndo(): boolean {
  return false;
}

export { emitSeedSeotdaStateToSocket };
