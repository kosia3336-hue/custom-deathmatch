import type { GameState } from '@shared/types/events.js';
import type { IndianPokerGameData, IPBettingAction, IPPlayerInfo, IPRoundRecord } from '@shared/types/indian-poker.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { RESULT_DISPLAY_MS, WIN_DISPLAY_MS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type {
  InternalState, IPPlayerInternal, IPUndoSnapshot,
  InternalRoundRecord,
} from './types.js';
import { evaluateHand, judgeShowdown, getDiePenalty } from './judge.js';
import { deal, checkDeckReset } from './deck.js';
import { socketRoom } from '../../utils.js';
import { aiTakeTurn } from './ai.js';

export const gameStates = new Map<string, InternalState>();

/* ────────────────────── helpers ──────────────────────── */

function getOpponent(s: InternalState, playerId: string): IPPlayerInternal {
  return playerId === s.player1Id ? s.players[s.player2Id] : s.players[s.player1Id];
}

function playerToInfo(p: IPPlayerInternal, canSeeCard: boolean): IPPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    chips: p.chips,
    roundBet: p.roundBet,
    card: canSeeCard ? p.card : null,
    hand: null,
  };
}

function toClientRoundHistory(history: InternalRoundRecord[]): IPRoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    communityCards: r.communityCards,
    winnerId: r.winnerId,
    isDraw: r.isDraw,
    isDie: r.isDie,
    chipChanges: r.chipChanges,
    bettingActions: r.bettingActions,
    hands: Object.fromEntries(
      Object.entries(r.hands).map(([pid, h]) => [pid, { card: r.playerCards[pid], hand: h }]),
    ),
  }));
}

/* ────────────────────── state building ───────────────── */

function buildGameDataForPlayer(s: InternalState, viewerId: string): IndianPokerGameData {
  const isSpectator = viewerId !== s.player1Id && viewerId !== s.player2Id;
  const isShowingCards = s.phase === 'showdown' || s.phase === 'dieResult' || s.phase === 'finished';

  const players: Record<string, IPPlayerInfo> = {};
  for (const [pid, p] of Object.entries(s.players)) {
    let canSeeCard: boolean;
    if (isShowingCards) {
      canSeeCard = true;
    } else if (isSpectator) {
      canSeeCard = true;
    } else {
      canSeeCard = pid !== viewerId;
    }
    players[pid] = playerToInfo(p, canSeeCard);
  }

  return {
    round: s.round,
    phase: s.phase,
    communityCards: s.communityCards,
    players,
    pot: s.pot,
    currentTurnId: s.currentTurnId,
    currentBet: s.currentBet,
    ante: s.ante,
    deckRemaining: s.deck.length,
    deckCycle: s.deckCycle,
    firstBettorId: s.firstBettorId,
    bettingStarted: s.bettingStarted,
    currentRoundActions: s.currentRoundActions.map(
      (a): IPBettingAction => ({ playerId: a.playerId, action: a.action, amount: a.amount }),
    ),
    deckResetOccurred: s.deckResetOccurred,
    showdownData: s.showdownData,
    dieData: s.dieData,
    winner: s.winner,
    winType: s.winType,
    roundHistory: toClientRoundHistory(s.roundHistory),
  };
}

function phaseMessage(s: InternalState): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  if (s.phase === 'dealing') return `라운드 ${s.round} — 딜링 중...`;
  if (s.phase === 'betting') {
    const current = s.players[s.currentTurnId!];
    return `라운드 ${s.round} — ${current?.nickname ?? ''}의 베팅 차례`;
  }
  if (s.phase === 'showdown') return `라운드 ${s.round} — 쇼다운!`;
  if (s.phase === 'dieResult') return `라운드 ${s.round} — 다이`;
  return '';
}

function buildGameState(s: InternalState, gameData: IndianPokerGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: s.currentTurnId,
    turnNumber: s.totalBettingActions,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds ? s.turnStartedAt : null,
    gameData,
  };
}

/* ────────────────────── broadcasting ─────────────────── */

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const gameData = buildGameDataForPlayer(s, sock.id);
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const gameData = buildGameDataForPlayer(s, socket.id);
  socket.emit('game:state', buildGameState(s, gameData));
}

/* ────────────────────── turn timer ──────────────────── */

export function clearTurnTimer(s: InternalState) {
  if (s.turnTimer) {
    clearTimeout(s.turnTimer);
    s.turnTimer = null;
  }
}

function armTurnTimer(io: IO, s: InternalState) {
  clearTurnTimer(s);
  if (!s.timeLimitSeconds) return;
  if (s.playMode === 'com') return;
  s.turnStartedAt = Date.now();
  s.turnTimer = setTimeout(() => handleTimeout(io, s), s.timeLimitSeconds * 1000);
}

export function startTurnTimer(io: IO, s: InternalState) {
  armTurnTimer(io, s);
}

function handleTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'betting') return;
  clearTurnTimer(s);

  const loserId = s.currentTurnId!;
  const winnerId = loserId === s.player1Id ? s.player2Id : s.player1Id;
  resolveGame(io, s, winnerId, loserId, 'timeout');
}

/* ────────────────────── undo snapshots ───────────── */

function snapshotPlayer(p: IPPlayerInternal): IPUndoSnapshot['player1'] {
  return { chips: p.chips, roundBet: p.roundBet, card: p.card };
}

function restorePlayer(p: IPPlayerInternal, snap: IPUndoSnapshot['player1']) {
  p.chips = snap.chips;
  p.roundBet = snap.roundBet;
  p.card = snap.card;
}

function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    deck: [...s.deck],
    communityCards: s.communityCards ? [...s.communityCards] as [number, number] : null,
    player1: snapshotPlayer(s.players[s.player1Id]),
    player2: snapshotPlayer(s.players[s.player2Id]),
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
  });
}

function applySnapshot(s: InternalState, snap: IPUndoSnapshot) {
  s.round = snap.round;
  s.phase = snap.phase;
  s.deck = [...snap.deck];
  s.communityCards = snap.communityCards ? [...snap.communityCards] as [number, number] : null;
  restorePlayer(s.players[s.player1Id], snap.player1);
  restorePlayer(s.players[s.player2Id], snap.player2);
  s.pot = snap.pot;
  s.currentTurnId = snap.currentTurnId;
  s.currentBet = snap.currentBet;
  s.ante = snap.ante;
  s.deckCycle = snap.deckCycle;
  s.firstBettorId = snap.firstBettorId;
  s.bettingStarted = snap.bettingStarted;
  s.currentRoundActions = JSON.parse(JSON.stringify(snap.currentRoundActions));
  s.roundHistory = JSON.parse(JSON.stringify(snap.roundHistory));
  s.usedCards = [...snap.usedCards];
  s.totalBettingActions = snap.totalBettingActions;
  s.showdownData = null;
  s.dieData = null;
}

export function performIndianPokerUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;

  s.aiGeneration++;
  clearTurnTimer(s);

  if (s.playMode === 'com') {
    // COM 모드: 라운드 시작 시점으로 복원 (AI 턴 + 유저 턴 모두 롤백)
    if (s.undoSnapshots.length < 1) return false;
    const snap = s.undoSnapshots[s.undoSnapshots.length - 1];
    applySnapshot(s, snap);
  } else {
    // 멀티: 이번 라운드 중 일부 베팅이 있으면 라운드 시작으로, 아니면 이전 라운드로
    if (s.currentRoundActions.length > 0) {
      if (s.undoSnapshots.length < 1) return false;
      applySnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    } else {
      if (s.undoSnapshots.length < 2) return false;
      s.undoSnapshots.pop();
      applySnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
    }
  }

  armTurnTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }

  return true;
}

/* ────────────────────── game resolution ──────────────── */

function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string,
  loserId: string,
  winType: InternalState['winType'],
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  clearTurnTimer(s);
  broadcastState(io, s);

  const winnerP = s.players[winnerId];
  const loserP = s.players[loserId];

  const payload = {
    rankings: [
      { playerId: winnerId, nickname: winnerP.nickname, rank: 1, score: winnerP.chips },
      { playerId: loserId, nickname: loserP.nickname, rank: 2, score: loserP.chips },
    ],
    totalTurns: s.totalBettingActions,
    gameResultData: {
      winType: s.winType,
      finalChips: { [s.player1Id]: s.players[s.player1Id].chips, [s.player2Id]: s.players[s.player2Id].chips },
      totalRounds: s.round,
      deckCycles: s.deckCycle,
      finalAnte: s.ante,
      initialChips: s.initialChips,
      roundHistory: s.roundHistory,
      players: {
        [s.player1Id]: { nickname: s.players[s.player1Id].nickname },
        [s.player2Id]: { nickname: s.players[s.player2Id].nickname },
      },
    },
  };

  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  }, WIN_DISPLAY_MS);
}

/* ────────────────────── betting processing ───────────── */

export function processBettingAction(
  io: IO,
  s: InternalState,
  playerId: string,
  action: { type: string; amount?: number },
) {
  const player = s.players[playerId];
  const opponent = getOpponent(s, playerId);

  s.currentRoundActions.push({
    playerId,
    action: action.type as any,
    amount: action.type === 'raise' ? action.amount : undefined,
  });
  s.totalBettingActions++;

  switch (action.type) {
    case 'check':
      s.currentTurnId = opponent.id;
      break;

    case 'call': {
      const callCost = opponent.roundBet - player.roundBet;
      player.chips -= callCost;
      player.roundBet = opponent.roundBet;
      s.pot += callCost;
      processShowdown(io, s);
      return;
    }

    case 'raise': {
      const amount = action.amount!;
      const additionalCost = amount - player.roundBet;
      player.chips -= additionalCost;
      player.roundBet = amount;
      s.pot += additionalCost;
      s.bettingStarted = true;
      s.currentBet = amount;
      s.currentTurnId = opponent.id;
      break;
    }

    case 'die':
      processDie(io, s, playerId);
      return;
  }

  armTurnTimer(io, s);
  broadcastState(io, s);

  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }
}

/* ────────────────────── showdown ─────────────────────── */

function processShowdown(io: IO, s: InternalState) {
  s.phase = 'showdown';
  clearTurnTimer(s);

  const p1 = s.players[s.player1Id];
  const p2 = s.players[s.player2Id];

  const hand1 = evaluateHand(p1.card!, s.communityCards!);
  const hand2 = evaluateHand(p2.card!, s.communityCards!);

  const result = judgeShowdown(
    { id: p1.id, card: p1.card!, hand: hand1 },
    { id: p2.id, card: p2.card!, hand: hand2 },
  );

  if (result.isDraw) {
    const half = Math.floor(s.pot / 2);
    const remainder = s.pot - half * 2;
    p1.chips += half;
    p2.chips += half;
    if (remainder > 0) {
      s.players[s.firstBettorId].chips += remainder;
    }

    s.showdownData = {
      players: {
        [p1.id]: { card: p1.card!, hand: hand1, chipChange: half - (s.ante + p1.roundBet) },
        [p2.id]: { card: p2.card!, hand: hand2, chipChange: half - (s.ante + p2.roundBet) },
      },
      winnerId: null,
      isDraw: true,
    };
  } else {
    const winnerId = result.winnerId!;
    s.players[winnerId].chips += s.pot;

    s.showdownData = {
      players: {
        [p1.id]: {
          card: p1.card!, hand: hand1,
          chipChange: p1.id === winnerId ? s.pot - (s.ante + p1.roundBet) : -(s.ante + p1.roundBet),
        },
        [p2.id]: {
          card: p2.card!, hand: hand2,
          chipChange: p2.id === winnerId ? s.pot - (s.ante + p2.roundBet) : -(s.ante + p2.roundBet),
        },
      },
      winnerId,
      isDraw: false,
    };
  }

  saveRoundRecord(s, result, hand1, hand2);
  broadcastState(io, s);
  scheduleNextRound(io, s);
}

/* ────────────────────── die ──────────────────────────── */

function processDie(io: IO, s: InternalState, diedPlayerId: string) {
  s.phase = 'dieResult';
  clearTurnTimer(s);

  const diedPlayer = s.players[diedPlayerId];
  const opponent = getOpponent(s, diedPlayerId);

  const diedHand = evaluateHand(diedPlayer.card!, s.communityCards!);
  let penalty = getDiePenalty(diedHand);
  penalty = Math.min(penalty, diedPlayer.chips);

  opponent.chips += s.pot + penalty;
  diedPlayer.chips -= penalty;

  s.dieData = {
    diedPlayerId,
    diedCard: diedPlayer.card!,
    diedHand,
    penalty,
    potAmount: s.pot,
    chipChanges: {
      [diedPlayerId]: -(s.ante + diedPlayer.roundBet + penalty),
      [opponent.id]: s.pot + penalty - (s.ante + opponent.roundBet),
    },
  };

  const opponentHand = evaluateHand(opponent.card!, s.communityCards!);
  saveRoundRecord(
    s,
    { winnerId: opponent.id, isDraw: false },
    diedPlayerId === s.player1Id ? diedHand : opponentHand,
    diedPlayerId === s.player2Id ? diedHand : opponentHand,
    true,
  );

  broadcastState(io, s);
  scheduleNextRound(io, s);
}

/* ────────────────────── record + advance ─────────────── */

function saveRoundRecord(
  s: InternalState,
  result: { winnerId: string | null; isDraw: boolean },
  hand1: import('@shared/types/indian-poker.js').IPHand,
  hand2: import('@shared/types/indian-poker.js').IPHand,
  isDie = false,
) {
  s.roundHistory.push({
    round: s.round,
    communityCards: [...s.communityCards!] as [number, number],
    playerCards: {
      [s.player1Id]: s.players[s.player1Id].card!,
      [s.player2Id]: s.players[s.player2Id].card!,
    },
    winnerId: result.winnerId,
    isDraw: result.isDraw,
    isDie,
    chipChanges: {
      [s.player1Id]: s.players[s.player1Id].chips,
      [s.player2Id]: s.players[s.player2Id].chips,
    },
    bettingActions: [...s.currentRoundActions],
    hands: {
      [s.player1Id]: hand1,
      [s.player2Id]: hand2,
    },
  });
}

function scheduleNextRound(io: IO, s: InternalState) {
  const gen = s.aiGeneration;
  setTimeout(() => {
    if (!gameStates.has(s.roomId)) return;
    if (s.aiGeneration !== gen) return;
    advanceRound(io, s);
  }, RESULT_DISPLAY_MS);
}

function checkGameEnd(s: InternalState): boolean {
  for (const player of Object.values(s.players)) {
    if (player.chips <= 0) {
      const winner = Object.values(s.players).find(p => p.chips > 0)!;
      s.winner = winner.id;
      s.winType = 'chipOut';
      return true;
    }
  }
  return false;
}

function checkAnteAffordable(s: InternalState): string | null {
  for (const player of Object.values(s.players)) {
    if (player.chips < s.ante) return player.id;
  }
  return null;
}

/** 직전 라운드 결과를 바탕으로 다음 선 플레이어를 결정한다.
 *  - 승자 있음: 승자가 선
 *  - 무승부: 이전 선 플레이어 유지
 *  - 다이: 다이하지 않은 플레이어(승자)가 선
 */
function resolveNextFirstBettorId(s: InternalState): string {
  if (s.showdownData) {
    if (s.showdownData.isDraw) return s.firstBettorId;
    if (s.showdownData.winnerId) return s.showdownData.winnerId;
  }
  if (s.dieData) {
    return s.dieData.diedPlayerId === s.player1Id ? s.player2Id : s.player1Id;
  }
  // 폴백: 교대 (정상 흐름에서 도달하지 않음)
  return s.firstBettorId === s.player1Id ? s.player2Id : s.player1Id;
}

export function advanceRound(io: IO, s: InternalState) {
  // 1. 게임 종료 검사 (칩 0)
  if (checkGameEnd(s)) {
    const loserId = s.winner === s.player1Id ? s.player2Id : s.player1Id;
    resolveGame(io, s, s.winner!, loserId, 'chipOut');
    return;
  }

  // 2. 덱 리셋 검사
  s.deckResetOccurred = checkDeckReset(s);

  // 3. 앤트 지불 가능 검사
  const cantAffordId = checkAnteAffordable(s);
  if (cantAffordId) {
    const winnerId = cantAffordId === s.player1Id ? s.player2Id : s.player1Id;
    resolveGame(io, s, winnerId, cantAffordId, 'anteLack');
    return;
  }

  // 4. 다음 선 플레이어 결정 (showdown/die 결과 참조, 리셋 전에 읽어야 함)
  const nextFirstBettorId = resolveNextFirstBettorId(s);

  // 5. 라운드 상태 리셋
  s.round += 1;
  s.pot = 0;
  s.currentBet = 0;
  s.bettingStarted = false;
  s.showdownData = null;
  s.dieData = null;
  s.currentRoundActions = [];
  s.firstBettorId = nextFirstBettorId;
  // deckResetOccurred는 위에서 이미 set, 다음 라운드 시작 브로드캐스트 후 해제됨

  // 6. 앤트 차감
  for (const player of Object.values(s.players)) {
    player.chips -= s.ante;
    player.roundBet = 0;
    s.pot += s.ante;
  }

  // 7. 딜링
  deal(s);

  // 8. 베팅 시작 (phase·currentTurnId를 확정한 뒤 스냅샷을 찍어야
  //    무르기 복원 시 'betting' 상태로 정확히 돌아옴)
  s.phase = 'betting';
  s.currentTurnId = s.firstBettorId;

  // 9. 스냅샷
  pushUndoSnapshot(s);

  // 10. 타이머 시작
  armTurnTimer(io, s);

  // 11. 브로드캐스트 (deckResetOccurred = true 상태로 전송)
  broadcastState(io, s);

  // 클라이언트가 수신한 뒤 플래그 해제 (이후 재전송 시 중복 toast 방지)
  s.deckResetOccurred = false;

  // 12. AI 턴
  if (s.playMode === 'com' && s.currentTurnId === s.player2Id) {
    aiTakeTurn(io, s);
  }
}
