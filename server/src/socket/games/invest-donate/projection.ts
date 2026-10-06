import type { GameState } from '@shared/types/events.js';
import type {
  InvestDonateGameData,
  IDPlayerInfo,
  IDRoundRecord,
  IDRevealData,
  IDRevealPlayerData,
} from '@shared/types/invest-donate.js';
import type { InternalState, InternalRoundRecord, IDPlayerInternal } from './types.js';
import { sessions } from '../../../store/sessions.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { inputPhaseClock } from '../../gameClock.js';

function playerToInfo(p: IDPlayerInternal, revealSelf: boolean): IDPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    coinStock: { ...p.coinStock },
    submitted: p.submitted,
    investCoins: revealSelf ? p.investCoins : null,
    donateCoins: revealSelf ? p.donateCoins : null,
    investBadge: p.investBadge,
    donateBadge: p.donateBadge,
  };
}

function toClientRoundHistory(history: InternalRoundRecord[]): IDRoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    players: Object.fromEntries(Object.entries(r.players).map(([pid, pr]) => [pid, { ...pr }])),
  }));
}

/* ────────── broadcasting ────────── */

function buildRevealData(s: InternalState): IDRevealData | null {
  if ((s.phase !== 'reveal' && s.phase !== 'finished') || s.roundHistory.length === 0) return null;
  const last = s.roundHistory[s.roundHistory.length - 1];
  if (last.round !== s.round) return null;
  const players: Record<string, IDRevealPlayerData> = {};
  for (const [pid, rec] of Object.entries(last.players)) {
    players[pid] = {
      investCoins: rec.investCoins,
      donateCoins: rec.donateCoins,
      investTotal: rec.investTotal,
      donateTotal: rec.donateTotal,
      investBadge: rec.investBadge,
      donateBadge: rec.donateBadge,
      scoreChange: rec.scoreChange,
    };
  }
  const investTied =
    last.players[s.player1.id]?.investBadge === null &&
    last.players[s.player2.id]?.investBadge === null;
  const donateTied =
    last.players[s.player1.id]?.donateBadge === 'miser' &&
    last.players[s.player2.id]?.donateBadge === 'miser';
  return { players, investTied, donateTied };
}

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    if (s.winType === 'timeout') return '시간 초과로 게임이 종료되었습니다.';
    if (s.winType === 'elimination') return '승점 0점으로 탈락하여 게임이 종료되었습니다.';
    return '게임이 종료되었습니다.';
  }
  if (s.phase === 'reveal') return `라운드 ${s.round} — 결과`;
  if (s.phase === 'submit') return `라운드 ${s.round} — 투자와 기부를 배분하세요`;
  return '';
}

export function buildGameDataForPlayer(s: InternalState, socketId: string): InvestDonateGameData {
  const isP1 = socketId === s.player1.id;
  const isP2 = socketId === s.player2.id;
  const isReveal = s.phase === 'reveal' || s.phase === 'finished';
  const _dbg = isDbgViewer(s.playMode, sessions.getMemberId(socketId));
  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, socketId);

  const players: Record<string, IDPlayerInfo> = {
    [s.player1.id]: {
      ...playerToInfo(s.player1, isReveal || isP1 || (_dbg && isP2)),
      nickname: maskNick(s.player1.id, s.player1.nickname),
    },
    [s.player2.id]: {
      ...playerToInfo(s.player2, isReveal || isP2 || (_dbg && isP1)),
      nickname: maskNick(s.player2.id, s.player2.nickname),
    },
  };

  return {
    round: s.round,
    totalRounds: s.totalRounds,
    phase: s.phase,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.roundHistory),
    winner: s.winner,
    winType: s.winType,
    rematchReason: s.rematchReason,
    ...(s.revealEndsAt !== null ? { revealEndsAt: s.revealEndsAt } : {}),
    ...(s.finishedEndsAt !== null ? { finishedEndsAt: s.finishedEndsAt } : {}),
  };
}

export function buildSpectatorGameData(s: InternalState): InvestDonateGameData {
  const isReveal = s.phase === 'reveal' || s.phase === 'finished';
  /*
    관전자에게도 랭크 신원을 가린다. isTokenAnonymized 는 익명 물약만 보므로
    그것만 쓰면 랭크 판에서 두 사람의 실명이 관전석에 그대로 떴다.
    nicknameForViewer 가 물약과 랭크를 함께 보며, viewerId=null 이 '어느 쪽도 아닌 사람' 이다.
  */
  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, null);
  const players: Record<string, IDPlayerInfo> = {
    [s.player1.id]: {
      ...playerToInfo(s.player1, isReveal),
      nickname: maskNick(s.player1.id, s.player1.nickname),
    },
    [s.player2.id]: {
      ...playerToInfo(s.player2, isReveal),
      nickname: maskNick(s.player2.id, s.player2.nickname),
    },
  };

  return {
    round: s.round,
    totalRounds: s.totalRounds,
    phase: s.phase,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.roundHistory),
    winner: s.winner,
    winType: s.winType,
    rematchReason: s.rematchReason,
    ...(s.revealEndsAt !== null ? { revealEndsAt: s.revealEndsAt } : {}),
    ...(s.finishedEndsAt !== null ? { finishedEndsAt: s.finishedEndsAt } : {}),
  };
}

export function buildGameState(s: InternalState, gameData: InvestDonateGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    // 착수를 기다리는 단계에서만 시계를 보낸다 (socket/gameClock.ts)
    turnStartedAt: inputPhaseClock(s.timeLimitSeconds, s.phase, ['submit'], s.turnStartedAt),
    gameData,
  };
}
