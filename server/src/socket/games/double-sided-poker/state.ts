import type { GameState } from '@shared/types/events.js';
import type {
  DoubleSidedPokerArchiveRecord,
  DoubleSidedPokerGameData,
  DoubleSidedPokerRoundResult,
} from '@shared/types/double-sided-poker.js';
import { sessions } from '../../../store/sessions.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { DoubleSidedPokerState } from './types.js';

export const doubleSidedPokerStates = new Map<string, DoubleSidedPokerState>();

export function otherDoubleSidedPokerPlayerId(state: DoubleSidedPokerState, playerId: string) {
  return state.players.find((player) => player.id !== playerId)?.id ?? playerId;
}

function nicknameFor(
  state: DoubleSidedPokerState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return isTokenAnonymized(state.roomId, playerId) && playerId !== viewerId
    ? ANONYMOUS_NICKNAME
    : nickname;
}

function selectionMultiplier(
  selection: DoubleSidedPokerState['playerStates'][string]['selection'],
) {
  return selection === 'both' ? 2 : 1;
}

export function doubleSidedPokerBettingBounds(state: DoubleSidedPokerState) {
  const actorId = state.currentTurnId;
  if (!actorId || state.phase !== 'betting') {
    return {
      currentStake: 0,
      toCall: 0,
      minBet: null,
      maxBet: null,
      minRaise: null,
      maxRaise: null,
      canDouble: false,
      doubleCost: null,
      maxDouble: null,
    };
  }

  const opponentId = otherDoubleSidedPokerPlayerId(state, actorId);
  const actor = state.playerStates[actorId];
  const opponent = state.playerStates[opponentId];
  const currentStake = Math.max(actor.stake, opponent.stake);

  if (!state.bettingOpened) {
    const maxBet = Math.min(actor.chips, opponent.chips);
    /*
      여는 수로도 양면베팅할 수 있다. 앞뒤 두 칸에 같은 칩을 내므로 고른 금액의
      두 배가 필요하고, 상대가 한 면으로 받을 수 있는 만큼까지만 올릴 수 있다.
    */
    const maxDouble = Math.min(Math.floor(actor.chips / 2), opponent.chips);
    return {
      currentStake,
      toCall: 0,
      minBet: maxBet >= 1 ? 1 : null,
      maxBet: maxBet >= 1 ? maxBet : null,
      minRaise: null,
      maxRaise: null,
      canDouble: actor.selection == null && opponent.selection == null && maxDouble >= 1,
      doubleCost: null,
      maxDouble: maxDouble >= 1 ? maxDouble : null,
    };
  }

  const actorMultiplier = selectionMultiplier(actor.selection);
  const opponentMultiplier = selectionMultiplier(opponent.selection);
  const toCall = Math.max(0, currentStake - actor.stake) * actorMultiplier;
  const actorMaxStake = actor.stake + Math.floor(actor.chips / actorMultiplier);
  const opponentMaxStake = opponent.stake + Math.floor(opponent.chips / opponentMultiplier);
  const maxRaise = Math.min(actorMaxStake, opponentMaxStake);
  /*
    양면베팅으로 받을 때도 금액을 고를 수 있다. 기준액을 그대로 맞추면 콜과
    같고, 그보다 높이 걸면 그게 곧 양면 레이즈다.

    한 면에 걸 수 있는 최대는 두 가지에 걸린다 — 내가 앞뒤로 두 배를 내야 하고
    (chips / 2), 상대가 한 면으로 받을 수 있어야 한다(상대 stake + chips).
  */
  const maxDoubleStake = Math.min(
    Math.floor(actor.chips / 2),
    opponent.stake + opponent.chips,
  );
  const canDouble =
    actor.selection == null &&
    opponent.selection != null &&
    opponent.selection !== 'both' &&
    currentStake > 0 &&
    maxDoubleStake >= currentStake;

  return {
    currentStake,
    toCall,
    minBet: null,
    maxBet: null,
    minRaise: maxRaise > currentStake ? currentStake + 1 : null,
    maxRaise: maxRaise > currentStake ? maxRaise : null,
    canDouble,
    // 그대로 맞출 때 드는 칩(최소). 더 걸면 그만큼 늘어난다.
    doubleCost: canDouble ? currentStake * 2 : null,
    maxDouble: canDouble ? maxDoubleStake : null,
  };
}

export function cloneDoubleSidedPokerRoundResult(
  result: DoubleSidedPokerRoundResult,
): DoubleSidedPokerRoundResult {
  return {
    ...result,
    cards: Object.fromEntries(
      Object.entries(result.cards).map(([playerId, card]) => [playerId, { ...card }]),
    ),
    selections: { ...result.selections },
    bets: Object.fromEntries(
      Object.entries(result.bets).map(([playerId, bet]) => [playerId, { ...bet }]),
    ),
    chipCountsAfter: { ...result.chipCountsAfter },
    actions: result.actions.map((action) => ({ ...action })),
  };
}

export function toDoubleSidedPokerGameData(
  state: DoubleSidedPokerState,
  viewerId: string | null,
): DoubleSidedPokerGameData {
  const bounds = doubleSidedPokerBettingBounds(state);
  const revealResult = state.phase === 'betting' ? null : state.lastRoundResult;
  return {
    phase: state.phase,
    playMode: state.playMode,
    round: state.round,
    ante: state.ante,
    carryRound: state.carryRound,
    pot: state.pot,
    deckRemaining: state.deck.length,
    deckCycles: state.deckCycles,
    players: Object.fromEntries(
      state.players.map((player) => {
        const internal = state.playerStates[player.id];
        const ownCard = viewerId === player.id;
        const revealedBack = revealResult?.cards[player.id]?.back ?? null;
        return [
          player.id,
          {
            id: player.id,
            nickname: nicknameFor(state, viewerId, player.id, player.nickname),
            chips: internal.chips,
            card: internal.card
              ? {
                  front: internal.card.front,
                  back: ownCard ? internal.card.back : revealedBack,
                }
              : null,
            selection: internal.selection,
            stake: internal.stake,
            frontBet: internal.frontBet,
            backBet: internal.backBet,
          },
        ];
      }),
    ),
    firstPlayerId: state.firstPlayerId,
    currentTurnId: state.currentTurnId,
    bettingOpened: state.bettingOpened,
    selectOnly: state.selectOnly,
    doubleBettorId: state.doubleBettorId,
    ...bounds,
    lastRoundResult: state.lastRoundResult
      ? cloneDoubleSidedPokerRoundResult(state.lastRoundResult)
      : null,
    roundStartedAt: state.roundStartedAt,
    turnStartedAt: state.turnStartedAt,
    turnSeconds: state.turnSeconds,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function gameMessage(state: DoubleSidedPokerState) {
  if (state.phase === 'finished') return state.finishReason ?? '게임 종료';
  if (state.phase === 'round-result') {
    if (state.lastRoundResult?.reason === 'tie')
      return '무승부입니다. 팟을 다음 라운드로 넘깁니다.';
    return '라운드가 종료되었습니다.';
  }
  if (state.selectOnly)
    return '걸 칩이 없습니다. 겨룰 면만 골라 이월된 팟의 주인을 가립니다.';
  if (state.doubleBettorId) return '양면베팅이 선언되었습니다. 콜, 레이즈 또는 다이하세요.';
  return state.bettingOpened
    ? '콜, 레이즈, 양면베팅 또는 다이를 선택하세요.'
    : '앞면 또는 뒷면을 선택해 최소 1칩을 베팅하세요.';
}

function toGameState(state: DoubleSidedPokerState, data: DoubleSidedPokerGameData): GameState {
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

export async function broadcastDoubleSidedPokerState(io: IO, state: DoubleSidedPokerState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(state, toDoubleSidedPokerGameData(state, isPlayer ? playerId : null)),
    );
  }
}

export function emitDoubleSidedPokerStateToSocket(socket: TypedSocket, roomId: string) {
  const state = doubleSidedPokerStates.get(roomId);
  if (!state) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(state, toDoubleSidedPokerGameData(state, isPlayer ? playerId : null)),
  );
}

export function clearDoubleSidedPokerTimers(state: DoubleSidedPokerState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.transitionTimer) clearTimeout(state.transitionTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.turnTimer = null;
  state.transitionTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toDoubleSidedPokerRecord(
  state: DoubleSidedPokerState,
): DoubleSidedPokerArchiveRecord {
  return {
    rounds: state.roundResults.map(cloneDoubleSidedPokerRoundResult),
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
