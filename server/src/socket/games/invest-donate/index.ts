import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IDCoinAllocation } from '@shared/types/invest-donate.js';
import { ID_INITIAL_SCORE, ID_INITIAL_COIN_STOCK, ID_TOTAL_ROUNDS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, IDPlayerInternal } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startRoundTimer,
  clearRoundTimer,
  processRound,
  performInvestDonateUndo,
} from './state.js';
import { aiSubmit } from './ai.js';

export type { EndGameFn };
export { performInvestDonateUndo };

export function initInvestDonate(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearRoundTimer(prev);
  gameStates.delete(roomId);

  const p1 = makePlayer(players[0].id, players[0].nickname);
  const p2 = makePlayer(players[1].id, players[1].nickname);

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    round: 1,
    totalRounds: ID_TOTAL_ROUNDS,
    phase: 'submit',
    player1: p1,
    player2: p2,
    roundHistory: [],
    winner: null,
    winType: null,
    rematchReason: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    roundTimer: null,
    playMode,
    gameOver: false,
    actionLog: [],
    undoSnapshots: [],
    aiGeneration: 0,
  });

  const s = gameStates.get(roomId)!;
  startRoundTimer(io, s);
  broadcastState(io, s);
}

function makePlayer(id: string, nickname: string): IDPlayerInternal {
  return {
    id,
    nickname,
    score: ID_INITIAL_SCORE,
    coinStock: { ...ID_INITIAL_COIN_STOCK },
    submitted: false,
    investCoins: null,
    donateCoins: null,
    investBadge: null,
    donateBadge: null,
  };
}

export function handleInvestDonateAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  switch (data.type) {
    case 'submit':
      handleSubmit(io, socket, s, data);
      break;
    case 'cancelSubmit':
      handleCancelSubmit(io, socket, s);
      break;
  }
}

function parseAllocation(data: unknown): IDCoinAllocation | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const coin50 = obj.coin50;
  const coin10 = obj.coin10;
  const coin1 = obj.coin1;
  if (typeof coin50 !== 'number' || typeof coin10 !== 'number' || typeof coin1 !== 'number') return null;
  if (!Number.isInteger(coin50) || !Number.isInteger(coin10) || !Number.isInteger(coin1)) return null;
  if (coin50 < 0 || coin10 < 0 || coin1 < 0) return null;
  if (coin50 > ID_INITIAL_COIN_STOCK.coin50 || coin10 > ID_INITIAL_COIN_STOCK.coin10 || coin1 > ID_INITIAL_COIN_STOCK.coin1) return null;
  return { coin50, coin10, coin1 };
}

function handleSubmit(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  data: Record<string, unknown>,
) {
  if (s.phase !== 'submit') {
    socket.emit('error', { message: '현재 제출할 수 없는 상태입니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const player = getPlayer(s, myId);
  if (!player) return;

  if (player.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }

  const invest = parseAllocation(data.invest);
  const donate = parseAllocation(data.donate);
  if (!invest || !donate) {
    socket.emit('error', { message: '유효하지 않은 코인 개수입니다.' });
    return;
  }

  if (invest.coin50 + donate.coin50 > player.coinStock.coin50) {
    socket.emit('error', { message: '보유한 50원짜리 코인이 부족합니다.' });
    return;
  }
  if (invest.coin10 + donate.coin10 > player.coinStock.coin10) {
    socket.emit('error', { message: '보유한 10원짜리 코인이 부족합니다.' });
    return;
  }
  if (invest.coin1 + donate.coin1 > player.coinStock.coin1) {
    socket.emit('error', { message: '보유한 1원짜리 코인이 부족합니다.' });
    return;
  }

  player.investCoins = invest;
  player.donateCoins = donate;
  player.submitted = true;

  if (s.player1.submitted && s.player2.submitted) {
    processRound(io, s);
    return;
  }

  broadcastState(io, s);

  if (s.playMode === 'com' && myId !== AI_PLAYER_ID) {
    aiSubmit(io, s);
  }
}

function handleCancelSubmit(io: IO, socket: TypedSocket, s: import('./types.js').InternalState) {
  if (s.phase !== 'submit') {
    socket.emit('error', { message: '현재 취소할 수 없는 상태입니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const player = getPlayer(s, myId);
  if (!player) return;

  if (!player.submitted) {
    socket.emit('error', { message: '제출하지 않았습니다.' });
    return;
  }

  const opponent = getOpponent(s, myId);
  if (opponent && opponent.submitted) {
    socket.emit('error', { message: '상대가 이미 제출하여 취소할 수 없습니다.' });
    return;
  }

  player.submitted = false;
  player.investCoins = null;
  player.donateCoins = null;
  broadcastState(io, s);
}

function getPlayer(s: import('./types.js').InternalState, socketId: string): IDPlayerInternal | null {
  if (s.player1.id === socketId) return s.player1;
  if (s.player2.id === socketId) return s.player2;
  return null;
}

function getOpponent(s: import('./types.js').InternalState, socketId: string): IDPlayerInternal | null {
  if (s.player1.id === socketId) return s.player2;
  if (s.player2.id === socketId) return s.player1;
  return null;
}

export function canInvestDonateUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'submit' || s.player1.submitted || s.player2.submitted;
  // 라운드 시작 직후(partial 없음)에는 현재 라운드 스냅샷 아래에 이전 라운드 스냅샷이 필요하므로 2개 요구
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

export function cleanupInvestDonate(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getInvestDonateState(roomId: string) {
  return gameStates.get(roomId);
}

/**
 * 더미용 공개 뷰. 상대 코인 잔고·과거 총액은 UI와 같이 공개.
 * 이번 라운드 상대 invest/donate 는 숨김.
 */
export function getInvestDonateDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    totalRounds: s.totalRounds,
    myId: me.id,
    oppId: opp.id,
    my: {
      score: me.score,
      coinStock: { ...me.coinStock },
      submitted: me.submitted,
    },
    opp: {
      score: opp.score,
      coinStock: { ...opp.coinStock },
      submitted: opp.submitted,
    },
    roundHistory: s.roundHistory.map((r) => ({
      round: r.round,
      players: Object.fromEntries(
        Object.entries(r.players).map(([pid, pr]) => [pid, { ...pr }]),
      ),
    })),
    winner: s.winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}

export function emitInvestDonateStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export { getInvestDonateResultData } from './state.js';
