import type { GameState } from '@shared/types/events.js';
import type {
  BettingRpsGameData,
  BRPSPlayerInfo,
  BRPSRevealData,
  BRPSRevealPlayerData,
  BRPSRoundRecord,
} from '@shared/types/betting-rps.js';
import type { InternalState, BRPSPlayerInternal, BRPSRoundActionLog } from './types.js';
import { sessions } from '../../../store/sessions.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { inputPhaseClock } from '../../gameClock.js';

export function isRevealPhase(s: InternalState): boolean {
  return s.phase === 'reveal' || s.phase === 'finished';
}

function playerToInfo(p: BRPSPlayerInternal, revealSelf: boolean): BRPSPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    chips: p.chips,
    role: p.role,
    hasChoiceRight: p.hasChoiceRight,
    submitted: p.submitted,
    matchResult: revealSelf ? p.matchResult : null,
    prediction: revealSelf ? p.prediction : null,
    betChips: revealSelf ? p.betChips : null,
  };
}

function toClientRoundHistory(history: BRPSRoundActionLog[]): BRPSRoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    choiceRightPlayerId: r.choiceRightPlayerId,
    players: Object.fromEntries(
      Object.entries(r.players).map(([pid, pr]) => [
        pid,
        {
          role: pr.role,
          matchResult: pr.matchResult,
          prediction: pr.prediction,
          betChips: pr.betChips,
          betOutcome: pr.betOutcome,
          chipsBefore: pr.chipsBefore,
          chipsAfter: pr.chipsAfter,
          chipChange: pr.chipChange,
        },
      ]),
    ),
  }));
}

function buildRevealData(s: InternalState): BRPSRevealData | null {
  if (!isRevealPhase(s) || s.actionLog.length === 0) return null;
  const last = s.actionLog[s.actionLog.length - 1];
  if (last.round !== s.round) return null;
  const players: Record<string, BRPSRevealPlayerData> = {};
  for (const [pid, pr] of Object.entries(last.players)) {
    players[pid] = {
      role: pr.role,
      matchResult: pr.matchResult,
      prediction: pr.prediction,
      betChips: pr.betChips,
      betOutcome: pr.betOutcome,
      chipsBefore: pr.chipsBefore,
      chipsAfter: pr.chipsAfter,
      chipChange: pr.chipChange,
    };
  }
  return { players };
}

export function buildGameDataForPlayer(s: InternalState, socketId: string): BettingRpsGameData {
  const reveal = isRevealPhase(s);
  const _dbg = isDbgViewer(s.playMode, sessions.getMemberId(socketId));
  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, socketId);
  const players: Record<string, BRPSPlayerInfo> = {
    [s.player1.id]: {
      ...playerToInfo(
        s.player1,
        reveal || socketId === s.player1.id || (_dbg && socketId === s.player2.id),
      ),
      nickname: maskNick(s.player1.id, s.player1.nickname),
    },
    [s.player2.id]: {
      ...playerToInfo(
        s.player2,
        reveal || socketId === s.player2.id || (_dbg && socketId === s.player1.id),
      ),
      nickname: maskNick(s.player2.id, s.player2.nickname),
    },
  };
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: s.totalRounds,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.actionLog),
    winner: s.winner,
    winType: s.winType,
    ...(s.revealEndsAt !== null ? { revealEndsAt: s.revealEndsAt } : {}),
    ...(s.finishedEndsAt !== null ? { finishedEndsAt: s.finishedEndsAt } : {}),
  };
}

function playerToSpectatorInfo(p: BRPSPlayerInternal, reveal: boolean): BRPSPlayerInfo {
  if (reveal) return playerToInfo(p, true);
  // roleSelect / submit 페이즈: 칩 수만 공개, 역할·선택권·제출 여부는 숨김
  return {
    id: p.id,
    nickname: p.nickname,
    chips: p.chips,
    role: null,
    hasChoiceRight: false,
    submitted: false,
    matchResult: null,
    prediction: null,
    betChips: null,
  };
}

export function buildSpectatorGameData(s: InternalState): BettingRpsGameData {
  const reveal = isRevealPhase(s);
  /*
    관전자에게도 랭크 신원을 가린다. isTokenAnonymized 는 익명 물약만 보므로
    그것만 쓰면 랭크 판에서 두 사람의 실명이 관전석에 그대로 떴다.
    nicknameForViewer 가 물약과 랭크를 함께 보며, viewerId=null 이 '어느 쪽도 아닌 사람' 이다.
  */
  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, null);
  const players: Record<string, BRPSPlayerInfo> = {
    [s.player1.id]: {
      ...playerToSpectatorInfo(s.player1, reveal),
      nickname: maskNick(s.player1.id, s.player1.nickname),
    },
    [s.player2.id]: {
      ...playerToSpectatorInfo(s.player2, reveal),
      nickname: maskNick(s.player2.id, s.player2.nickname),
    },
  };
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: s.totalRounds,
    players,
    revealData: buildRevealData(s),
    roundHistory: toClientRoundHistory(s.actionLog),
    winner: s.winner,
    winType: s.winType,
    ...(s.revealEndsAt !== null ? { revealEndsAt: s.revealEndsAt } : {}),
    ...(s.finishedEndsAt !== null ? { finishedEndsAt: s.finishedEndsAt } : {}),
  };
}

function phaseMessage(s: InternalState): string {
  if (s.phase === 'roleSelect') return `라운드 ${s.round} — 역할을 선택하세요`;
  if (s.phase === 'submit') return `라운드 ${s.round} — 제출하세요`;
  if (s.phase === 'reveal') return `라운드 ${s.round} — 결과`;
  return '게임이 종료되었습니다.';
}

export function buildGameState(s: InternalState, gameData: BettingRpsGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    // 착수를 기다리는 단계에서만 시계를 보낸다 (socket/gameClock.ts)
    turnStartedAt: inputPhaseClock(
      s.timeLimitSeconds,
      s.phase,
      ['roleSelect', 'submit'],
      s.turnStartedAt,
    ),
    gameData,
  };
}
