import type { GameState } from '@shared/types/events.js';
import type {
  IndianPokerGameData,
  IPBettingAction,
  IPPlayerInfo,
  IPRoundRecord,
} from '@shared/types/indian-poker.js';
import type { InternalState, IPPlayerInternal, InternalRoundRecord } from './types.js';
import { sessions } from '../../../store/sessions.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import { inputPhaseClock } from '../../gameClock.js';

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

export function buildGameDataForPlayer(s: InternalState, viewerId: string): IndianPokerGameData {
  const isSpectator = viewerId !== s.player1Id && viewerId !== s.player2Id;
  const isShowingCards =
    s.phase === 'showdown' || s.phase === 'dieResult' || s.phase === 'finished';
  const p1 = s.players[s.player1Id];
  const p2 = s.players[s.player2Id];
  const _dbg = p1 && p2 && isDbgViewer(s.playMode, sessions.getMemberId(viewerId));

  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, viewerId);
  const players: Record<string, IPPlayerInfo> = {};
  for (const [pid, p] of Object.entries(s.players)) {
    let canSeeCard: boolean;
    if (isShowingCards) {
      canSeeCard = true;
    } else if (isSpectator) {
      canSeeCard = isShowingCards; // showdown/dieResult/finished 때만 카드 공개
    } else {
      canSeeCard = pid !== viewerId || !!_dbg;
    }
    players[pid] = { ...playerToInfo(p, canSeeCard), nickname: maskNick(pid, p.nickname) };
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

function phaseMessage(s: InternalState, viewerToken: string): string {
  if (s.gameOver) return '게임이 종료되었습니다.';
  if (s.phase === 'dealing') return `라운드 ${s.round} — 딜링 중...`;
  if (s.phase === 'betting') {
    const current = s.players[s.currentTurnId!];
    const nick = current
      ? nicknameForViewer(s.roomId, current.id, current.nickname, viewerToken)
      : '';
    return `라운드 ${s.round} — ${nick}의 베팅 차례`;
  }
  if (s.phase === 'showdown') return `라운드 ${s.round} — 쇼다운!`;
  if (s.phase === 'dieResult') return `라운드 ${s.round} — 다이`;
  return '';
}

export function buildGameState(
  s: InternalState,
  gameData: IndianPokerGameData,
  viewerToken: string,
): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s, viewerToken),
    currentTurn: s.currentTurnId,
    turnNumber: s.totalBettingActions,
    startedAt: s.startedAt,
    // 착수를 기다리는 단계에서만 시계를 보낸다 (socket/gameClock.ts)
    turnStartedAt: inputPhaseClock(s.timeLimitSeconds, s.phase, ['betting'], s.turnStartedAt),
    gameData,
    activeSkin: getActiveSkin(s.roomId),
  };
}
