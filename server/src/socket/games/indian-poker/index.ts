import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import {
  INITIAL_CHIPS_DEFAULT, INITIAL_CHIPS_MIN, INITIAL_CHIPS_MAX, INITIAL_CHIPS_STEP,
  INITIAL_ANTE,
} from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, IPPlayerInternal, InternalState } from './types.js';
import { createDeck, deal } from './deck.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  clearTurnTimer,
  startTurnTimer,
  advanceRound,
  processBettingAction,
  performIndianPokerUndo,
} from './state.js';
import { aiTakeTurn } from './ai.js';

export type { EndGameFn };
export { performIndianPokerUndo };

function parseInitialChips(gameOptions: Record<string, unknown>): number {
  const raw = gameOptions['initialChips'];
  if (typeof raw !== 'number') return INITIAL_CHIPS_DEFAULT;
  if (raw < INITIAL_CHIPS_MIN || raw > INITIAL_CHIPS_MAX || raw % INITIAL_CHIPS_STEP !== 0) {
    return INITIAL_CHIPS_DEFAULT;
  }
  return raw;
}

export function initIndianPoker(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
  gameOptions: Record<string, unknown> = {},
) {
  const prev = gameStates.get(roomId);
  if (prev) clearTurnTimer(prev);
  gameStates.delete(roomId);

  const initialChips = parseInitialChips(gameOptions);

  const p1 = makePlayer(players[0].id, players[0].nickname, initialChips);
  const p2 = makePlayer(players[1].id, players[1].nickname, initialChips);

  const deck = createDeck();

  const s = {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'dealing' as const,
    deck,
    communityCards: null,
    player1Id: p1.id,
    player2Id: p2.id,
    players: { [p1.id]: p1, [p2.id]: p2 },
    pot: 0,
    currentTurnId: null,
    currentBet: 0,
    ante: INITIAL_ANTE,
    deckCycle: 1,
    firstBettorId: p1.id,
    bettingStarted: false,
    deckResetOccurred: false,
    roundAnte: INITIAL_ANTE,
    showdownData: null,
    dieData: null,
    winner: null,
    winType: null,
    currentRoundActions: [],
    roundHistory: [],
    usedCards: [],
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    turnTimer: null,
    playMode,
    gameOver: false,
    totalBettingActions: 0,
    undoSnapshots: [],
    aiGeneration: 0,
    initialChips,
  };

  gameStates.set(roomId, s);

  // 첫 라운드: 앤트 차감 + 딜링 + 베팅 시작
  startFirstRound(io, s);
}

function makePlayer(id: string, nickname: string, chips: number): IPPlayerInternal {
  return { id, nickname, chips, roundBet: 0, card: null };
}

function startFirstRound(io: IO, s: InternalState) {
  // 앤트 차감 (게임 시작 시 initialChips >= ante 보장)
  s.roundAnte = s.ante;
  for (const player of Object.values(s.players)) {
    player.chips -= s.ante;
    player.roundBet = 0;
    s.pot += s.ante;
  }

  // 딜링
  deal(s);

  // 베팅 시작 (phase·currentTurnId 확정 후 스냅샷 — 무르기 복원 정확성을 위해)
  s.phase = 'betting';
  s.currentTurnId = s.firstBettorId;

  s.undoSnapshots.push(createSnapshot(s));

  startTurnTimer(io, s);
  broadcastState(io, s);

  // AI가 선일 때
  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }
}

function createSnapshot(s: InternalState) {
  return {
    round: s.round,
    phase: s.phase,
    deck: [...s.deck],
    communityCards: s.communityCards ? [...s.communityCards] as [number, number] : null,
    player1: { chips: s.players[s.player1Id].chips, roundBet: s.players[s.player1Id].roundBet, card: s.players[s.player1Id].card },
    player2: { chips: s.players[s.player2Id].chips, roundBet: s.players[s.player2Id].roundBet, card: s.players[s.player2Id].card },
    pot: s.pot,
    currentTurnId: s.currentTurnId,
    currentBet: s.currentBet,
    ante: s.ante,
    deckCycle: s.deckCycle,
    firstBettorId: s.firstBettorId,
    bettingStarted: s.bettingStarted,
    currentRoundActions: JSON.parse(JSON.stringify(s.currentRoundActions)),
    roundHistory: JSON.parse(JSON.stringify(s.roundHistory)),
    usedCards: [...s.usedCards],
    totalBettingActions: s.totalBettingActions,
  };
}

export function handleIndianPokerAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  if (s.phase !== 'betting') {
    socket.emit('error', { message: '현재 베팅할 수 없는 상태입니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  if (s.currentTurnId !== myId) {
    socket.emit('error', { message: '지금은 상대의 턴입니다.' });
    return;
  }

  const actionType = data.type;
  if (typeof actionType !== 'string') return;

  const player = s.players[myId];
  const opponent = Object.values(s.players).find(p => p.id !== myId)!;

  switch (actionType) {
    case 'check': {
      if (s.bettingStarted || s.currentTurnId !== s.firstBettorId) {
        socket.emit('error', { message: '체크할 수 없습니다. 콜, 레이즈 또는 다이를 선택하세요.' });
        return;
      }
      processBettingAction(io, s, myId, { type: 'check' });
      break;
    }

    case 'call': {
      const callCost = opponent.roundBet - player.roundBet;
      if (callCost > player.chips) {
        socket.emit('error', { message: '콜할 칩이 부족합니다. 다이만 가능합니다.' });
        return;
      }
      processBettingAction(io, s, myId, { type: 'call' });
      break;
    }

    case 'raise': {
      const amount = data.amount;
      if (typeof amount !== 'number' || !Number.isInteger(amount)) {
        socket.emit('error', { message: '올바른 레이즈 금액을 입력해 주세요.' });
        return;
      }
      if (amount <= opponent.roundBet) {
        socket.emit('error', { message: '레이즈는 상대 베팅보다 많아야 합니다.' });
        return;
      }
      const additionalCost = amount - player.roundBet;
      if (additionalCost > player.chips) {
        socket.emit('error', { message: '보유 칩이 부족합니다.' });
        return;
      }
      const opponentMaxCall = opponent.roundBet + opponent.chips;
      if (amount > opponentMaxCall) {
        socket.emit('error', { message: '상대의 보유 칩을 초과한 레이즈는 불가능합니다.' });
        return;
      }
      processBettingAction(io, s, myId, { type: 'raise', amount });
      break;
    }

    case 'die': {
      processBettingAction(io, s, myId, { type: 'die' });
      break;
    }

    default:
      socket.emit('error', { message: '알 수 없는 액션입니다.' });
  }
}

export function canIndianPokerUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (s.currentRoundActions.length > 0) return s.undoSnapshots.length >= 1;
  return s.undoSnapshots.length >= 2;
}

export function cleanupIndianPoker(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTurnTimer(s);
  gameStates.delete(roomId);
}

export function getIndianPokerState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitIndianPokerStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}
