import type { GameState } from '@shared/types/events.js';
import type {
  SeedSeotdaArchiveRecord,
  SeedSeotdaCard,
  SeedSeotdaEvaluation,
  SeedSeotdaGameData,
  SeedSeotdaRoundResult,
} from '@shared/types/seed-seotda.js';
import { sessions } from '../../../store/sessions.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import { evaluateSeedSeotdaHand } from './judge.js';
import type { SeedSeotdaState } from './types.js';

export const seedSeotdaStates = new Map<string, SeedSeotdaState>();

function cloneCard(card: SeedSeotdaCard): SeedSeotdaCard {
  return { ...card };
}

function cloneEvaluation(evaluation: SeedSeotdaEvaluation): SeedSeotdaEvaluation {
  return { ...evaluation };
}

export function cloneSeedSeotdaRoundResult(result: SeedSeotdaRoundResult): SeedSeotdaRoundResult {
  return {
    ...result,
    seedCard: cloneCard(result.seedCard),
    hands: Object.fromEntries(
      Object.entries(result.hands).map(([playerId, cards]) => [
        playerId,
        cards?.map(cloneCard) ?? null,
      ]),
    ),
    evaluations: Object.fromEntries(
      Object.entries(result.evaluations).map(([playerId, hand]) => [
        playerId,
        hand ? cloneEvaluation(hand) : null,
      ]),
    ),
    seedChoices: { ...result.seedChoices },
    chipCountsAfter: { ...result.chipCountsAfter },
    actions: result.actions.map((action) => ({ ...action })),
  };
}

export function otherSeedSeotdaPlayerId(state: SeedSeotdaState, playerId: string) {
  return state.players.find((player) => player.id !== playerId)?.id ?? playerId;
}

function nicknameFor(
  state: SeedSeotdaState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return isTokenAnonymized(state.roomId, playerId) && playerId !== viewerId
    ? ANONYMOUS_NICKNAME
    : nickname;
}

export function seedSeotdaBettingBounds(state: SeedSeotdaState) {
  const actorId = state.currentTurnId;
  if (!actorId || state.phase !== 'betting') {
    return {
      currentBet: 0,
      toCall: 0,
      minBet: null,
      maxBet: null,
      minRaise: null,
      maxRaise: null,
    };
  }
  const opponentId = otherSeedSeotdaPlayerId(state, actorId);
  const actor = state.playerStates[actorId];
  const opponent = state.playerStates[opponentId];
  const currentBet = Math.max(actor.roundBet, opponent.roundBet);
  if (!state.bettingOpened) {
    const maxBet = Math.min(actor.chips, opponent.chips);
    return {
      currentBet,
      toCall: 0,
      minBet: maxBet >= 1 ? 1 : null,
      maxBet: maxBet >= 1 ? maxBet : null,
      minRaise: null,
      maxRaise: null,
    };
  }

  const toCall = Math.max(0, opponent.roundBet - actor.roundBet);
  const maxRaise = Math.min(actor.roundBet + actor.chips, opponent.roundBet + opponent.chips);
  return {
    currentBet,
    toCall,
    minBet: null,
    maxBet: null,
    minRaise: maxRaise > currentBet ? currentBet + 1 : null,
    maxRaise: maxRaise > currentBet ? maxRaise : null,
  };
}

export function toSeedSeotdaGameData(
  state: SeedSeotdaState,
  viewerId: string | null,
): SeedSeotdaGameData {
  const bounds = seedSeotdaBettingBounds(state);
  const revealResult = state.phase === 'round-result' ? state.lastRoundResult : null;
  return {
    phase: state.phase,
    playMode: state.playMode,
    round: state.round,
    ante: state.ante,
    carryRound: state.carryRound,
    players: Object.fromEntries(
      state.players.map((player) => {
        const internal = state.playerStates[player.id];
        const ownCards = viewerId === player.id;
        const publicHand = revealResult?.hands[player.id] ?? null;
        const publicEvaluation = revealResult?.evaluations[player.id] ?? null;
        const privateEvaluation =
          ownCards && internal.finalHand.length === 2
            ? evaluateSeedSeotdaHand(internal.finalHand)
            : null;
        return [
          player.id,
          {
            id: player.id,
            nickname: nicknameFor(state, viewerId, player.id, player.nickname),
            chips: internal.chips,
            roundBet: internal.roundBet,
            cards: ownCards ? internal.cards.map(cloneCard) : internal.cards.map(() => null),
            finalHand:
              publicHand != null
                ? publicHand.map(cloneCard)
                : ownCards
                  ? internal.finalHand.map(cloneCard)
                  : internal.finalHand.map(() => null),
            /*
              고르는 동안에는 상대가 무엇을 골랐는지 감춘다. 동시에 내고 둘 다
              내면 함께 열리는 방식이라, 먼저 낸 쪽의 선택이 새면 안 된다.
            */
            seedChoice:
              state.phase === 'seed-choice' && !ownCards ? 'pending' : internal.seedChoice,
            evaluation: publicEvaluation
              ? cloneEvaluation(publicEvaluation)
              : privateEvaluation
                ? cloneEvaluation(privateEvaluation)
                : null,
          },
        ];
      }),
    ),
    seedCard: state.seedCard ? cloneCard(state.seedCard) : null,
    pot: state.pot,
    deckRemaining: state.deck.length,
    currentTurnId: state.currentTurnId,
    firstPlayerId: state.firstPlayerId,
    bettingOpened: state.bettingOpened,
    ...bounds,
    lastRoundResult: state.lastRoundResult
      ? cloneSeedSeotdaRoundResult(state.lastRoundResult)
      : null,
    roundStartedAt: state.roundStartedAt,
    turnStartedAt: state.turnStartedAt,
    turnSeconds: state.turnSeconds,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function gameMessage(state: SeedSeotdaState) {
  switch (state.phase) {
    case 'seed-choice':
      return '시드를 사용할지 결정하세요.';
    case 'betting':
      return state.bettingOpened ? '콜, 레이즈 또는 다이를 선택하세요.' : '베팅을 시작하세요.';
    case 'round-result':
      if (state.lastRoundResult?.reason === 'gusa-rematch') return '구사 재경기입니다.';
      if (state.lastRoundResult?.reason === 'mung-gusa-rematch') {
        return '멍텅구리 구사 재경기입니다.';
      }
      if (state.lastRoundResult?.reason === 'tie') return '무승부 재경기입니다.';
      return '라운드가 종료되었습니다.';
    case 'finished':
      return state.finishReason ?? '게임 종료';
  }
}

function toGameState(state: SeedSeotdaState, data: SeedSeotdaGameData): GameState {
  return {
    roomId: state.roomId,
    message: gameMessage(state),
    currentTurn: state.currentTurnId,
    turnNumber: state.round,
    startedAt: state.startedAt,
    turnStartedAt: state.turnStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

export async function broadcastSeedSeotdaState(io: IO, state: SeedSeotdaState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(state, toSeedSeotdaGameData(state, isPlayer ? playerId : null)),
    );
  }
}

export function emitSeedSeotdaStateToSocket(socket: TypedSocket, roomId: string) {
  const state = seedSeotdaStates.get(roomId);
  if (!state) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(state, toSeedSeotdaGameData(state, isPlayer ? playerId : null)),
  );
}

export function clearSeedSeotdaTimers(state: SeedSeotdaState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.transitionTimer) clearTimeout(state.transitionTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.turnTimer = null;
  state.transitionTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toSeedSeotdaRecord(state: SeedSeotdaState): SeedSeotdaArchiveRecord {
  return {
    rounds: state.roundResults.map(cloneSeedSeotdaRoundResult),
    finalChips: Object.fromEntries(
      state.players.map((player) => [player.id, state.playerStates[player.id].chips]),
    ),
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
    totalRounds: state.roundResults.length,
    deckCycles: state.deckCycles,
  };
}
