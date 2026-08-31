import type { GameState } from '@shared/types/events.js';
import type {
  ChoiceHoldemArchiveRecord,
  ChoiceHoldemEvaluation,
  ChoiceHoldemGameData,
  ChoiceHoldemRoundResult,
} from '@shared/types/choice-holdem.js';
import { sessions } from '../../../store/sessions.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { ChoiceHoldemState } from './types.js';

export const choiceHoldemStates = new Map<string, ChoiceHoldemState>();

function cloneEvaluation(evaluation: ChoiceHoldemEvaluation): ChoiceHoldemEvaluation {
  return {
    category: evaluation.category,
    primaryValues: [...evaluation.primaryValues],
    privateKickers: [...evaluation.privateKickers],
  };
}

export function cloneChoiceHoldemRoundResult(
  result: ChoiceHoldemRoundResult,
): ChoiceHoldemRoundResult {
  return {
    ...result,
    communityCards: [...result.communityCards],
    holeCards: result.holeCards
      ? Object.fromEntries(
          Object.entries(result.holeCards).map(([playerId, cards]) => [playerId, [...cards]]),
        )
      : null,
    evaluations: result.evaluations
      ? Object.fromEntries(
          Object.entries(result.evaluations).map(([playerId, evaluation]) => [
            playerId,
            cloneEvaluation(evaluation),
          ]),
        )
      : null,
    chipCountsAfter: { ...result.chipCountsAfter },
    actions: result.actions.map((action) => ({ ...action })),
  };
}

function otherPlayerId(state: ChoiceHoldemState, playerId: string) {
  return state.players.find((player) => player.id !== playerId)?.id ?? playerId;
}

function nicknameFor(
  state: ChoiceHoldemState,
  viewerId: string | null,
  playerId: string,
  nickname: string,
) {
  return isTokenAnonymized(state.roomId, playerId) && playerId !== viewerId
    ? ANONYMOUS_NICKNAME
    : nickname;
}

export function choiceHoldemBettingBounds(state: ChoiceHoldemState) {
  const actorId = state.currentTurnId;
  if (!actorId || !['first-betting', 'second-betting'].includes(state.phase)) {
    return { currentBet: 0, toCall: 0, minRaise: null, maxRaise: null };
  }
  const opponentId = otherPlayerId(state, actorId);
  const actor = state.playerStates[actorId];
  const opponent = state.playerStates[opponentId];
  const currentBet = Math.max(actor.roundBet, opponent.roundBet);
  const toCall = Math.max(0, opponent.roundBet - actor.roundBet);
  const maxRaise = Math.min(actor.roundBet + actor.chips, opponent.roundBet + opponent.chips);
  return {
    currentBet,
    toCall,
    minRaise: maxRaise > currentBet ? currentBet + 1 : null,
    maxRaise: maxRaise > currentBet ? maxRaise : null,
  };
}

export function toChoiceHoldemGameData(
  state: ChoiceHoldemState,
  viewerId: string | null,
): ChoiceHoldemGameData {
  const revealAtShowdown =
    state.phase === 'round-result' && state.lastRoundResult?.holeCards != null;
  const faceUp = state.faceUpIndex == null ? null : state.choiceCards[state.faceUpIndex];
  const faceDownIndex = state.faceUpIndex == null ? null : state.faceUpIndex === 0 ? 1 : 0;
  const faceDown = faceDownIndex == null ? null : state.choiceCards[faceDownIndex];
  const selectorId = otherPlayerId(state, state.firstPlayerId);
  const arranged = state.faceUpIndex != null;
  const canSeeOptions = state.phase === 'arranging-choice' && viewerId === state.firstPlayerId;
  const canSeeFaceDown =
    arranged &&
    (revealAtShowdown ||
      viewerId === state.firstPlayerId ||
      (state.faceDownOwnerId != null && viewerId === state.faceDownOwnerId));
  const bounds = choiceHoldemBettingBounds(state);

  return {
    phase: state.phase,
    playMode: state.playMode,
    round: state.round,
    ante: state.ante,
    carryRound: state.carryRound,
    players: Object.fromEntries(
      state.players.map((player) => {
        const internal = state.playerStates[player.id];
        const canSeeCards = revealAtShowdown || viewerId === player.id;
        return [
          player.id,
          {
            id: player.id,
            nickname: nicknameFor(state, viewerId, player.id, player.nickname),
            chips: internal.chips,
            roundBet: internal.roundBet,
            cards: internal.cards.map((card, index) =>
              canSeeCards || (index === 1 && state.faceUpOwnerId === player.id) ? card : null,
            ),
          },
        ];
      }),
    ),
    communityCards: [...state.communityCards],
    pot: state.pot,
    currentTurnId: state.currentTurnId,
    firstPlayerId: state.firstPlayerId,
    selectorId,
    ...bounds,
    choice: {
      options: canSeeOptions ? [...state.choiceCards] : null,
      arranged,
      faceUp,
      faceDown: canSeeFaceDown ? faceDown : null,
      faceUpOwnerId: state.faceUpOwnerId,
      faceDownOwnerId: state.faceDownOwnerId,
    },
    lastRoundResult: state.lastRoundResult
      ? cloneChoiceHoldemRoundResult(state.lastRoundResult)
      : null,
    roundStartedAt: state.roundStartedAt,
    turnStartedAt: state.turnStartedAt,
    turnSeconds: state.turnSeconds,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
  };
}

function gameMessage(state: ChoiceHoldemState) {
  switch (state.phase) {
    case 'first-betting':
      return '1차 베팅을 진행하세요.';
    case 'arranging-choice':
      return '두 카드 중 한 장을 앞면으로 놓으세요.';
    case 'choosing-card':
      return '앞면 또는 뒷면 카드를 선택하세요.';
    case 'second-betting':
      return '2차 베팅을 진행하세요.';
    case 'round-result':
      return state.lastRoundResult?.reason === 'tie'
        ? '동률입니다. 팟을 유지하고 추가 베팅 없이 다시 진행합니다.'
        : '라운드가 종료되었습니다.';
    case 'finished':
      return state.finishReason ?? '게임 종료';
  }
}

function toGameState(state: ChoiceHoldemState, data: ChoiceHoldemGameData): GameState {
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

export async function broadcastChoiceHoldemState(io: IO, state: ChoiceHoldemState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = state.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(state, toChoiceHoldemGameData(state, isPlayer ? playerId : null)),
    );
  }
}

export function emitChoiceHoldemStateToSocket(socket: TypedSocket, roomId: string) {
  const state = choiceHoldemStates.get(roomId);
  if (!state) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = state.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(state, toChoiceHoldemGameData(state, isPlayer ? playerId : null)),
  );
}

export function clearChoiceHoldemTimers(state: ChoiceHoldemState) {
  if (state.turnTimer) clearTimeout(state.turnTimer);
  if (state.transitionTimer) clearTimeout(state.transitionTimer);
  if (state.aiTimer) clearTimeout(state.aiTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.turnTimer = null;
  state.transitionTimer = null;
  state.aiTimer = null;
  state.finishTimer = null;
}

export function toChoiceHoldemRecord(state: ChoiceHoldemState): ChoiceHoldemArchiveRecord {
  return {
    rounds: state.roundResults.map(cloneChoiceHoldemRoundResult),
    finalChips: Object.fromEntries(
      state.players.map((player) => [player.id, state.playerStates[player.id].chips]),
    ),
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
    totalRounds: state.roundResults.length,
  };
}
