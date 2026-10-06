/** 서버 내부 정보에서 소유자/관전자별 공개 데이터만 만든다. */
import type { GameState } from '@shared/types/events.js';
import type {
  NumberFourGameData,
  NF4PlayerInfo,
  NF4RoundRecord,
  NF4Number,
} from '@shared/types/number4.js';
import { sessions } from '../../../store/sessions.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';
import { inputPhaseClock } from '../../gameClock.js';
import type { InternalState, InternalRoundRecord, NF4PlayerInternal } from './types.js';

/** 진단 데이터는 별도 ext:data로만 전송한다. 게임 프로토콜에 합치지 않는다. */
export type ProjectedNumberFourData = NumberFourGameData & {
  _x?: {
    opponentSubmitted: { number: NF4Number | null; white: number | null; black: number | null };
  };
};

function playerToInfo(p: NF4PlayerInternal, isMe: boolean): NF4PlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    remainingWhite: isMe ? p.remainingWhite : -1,
    remainingBlack: isMe ? p.remainingBlack : -1,
    submitted: p.submitted,
    ...(isMe &&
    p.submitted &&
    p.submittedWhite !== null &&
    p.submittedBlack !== null &&
    p.submittedNumber !== null
      ? {
          submission: {
            white: p.submittedWhite,
            black: p.submittedBlack,
            number: p.submittedNumber,
          },
        }
      : {}),
  };
}

/** 타일 수치는 본인에게만 보낸다. 솔로 모드의 두 자리도 같은 플레이어 소유다. */
export function toClientRoundHistory(
  history: InternalRoundRecord[],
  ownIds: Set<string>,
): NF4RoundRecord[] {
  return history.map((r) => ({
    round: r.round,
    players: Object.fromEntries(
      Object.entries(r.players).map(([pid, pr]) => [
        pid,
        {
          number: pr.number,
          success: pr.success,
          scoreChange: pr.scoreChange,
          scoreAfter: pr.scoreAfter,
          ...(ownIds.has(pid) ? { white: pr.white, black: pr.black } : {}),
        },
      ]),
    ),
  }));
}

/* ────────────────────── broadcasting ─────────────────── */

function phaseMessage(s: InternalState): string {
  if (s.gameOver) {
    if (s.winType === 'timeout') return '시간 초과로 게임이 종료되었습니다.';
    if (s.winType === 'elimination') return '승점 0점으로 탈락하여 게임이 종료되었습니다.';
    return '게임이 종료되었습니다.';
  }

  if (s.playMode === 'solo' && s.currentSide) {
    const label = s.currentSide === 'player1' ? '1P' : '2P';
    if (s.phase === 'submit') return `라운드 ${s.round} — ${label} 타일과 넘버를 선택하세요`;
  }

  if (s.phase === 'submit') return `라운드 ${s.round} — 타일과 넘버를 선택하세요`;
  return '';
}

export function buildGameDataForPlayer(
  s: InternalState,
  socketId: string,
): ProjectedNumberFourData {
  if (s.tutorialData) {
    const data = structuredClone(s.tutorialData);
    for (const player of Object.values(data.players)) {
      if (player.id !== socketId) {
        player.remainingWhite = -1;
        player.remainingBlack = -1;
        delete player.submission;
      }
    }
    for (const round of data.roundHistory) {
      for (const [id, record] of Object.entries(round.players)) {
        if (id !== socketId) {
          delete record.white;
          delete record.black;
        }
      }
    }
    return data;
  }
  const isPlayer1 = socketId === s.player1.id;
  const isPlayer2 = socketId === s.player2.id;
  const isSolo = s.playMode === 'solo';
  const ownsSolo = isSolo && isPlayer1;
  const _dbg = !isSolo && isDbgViewer(s.playMode, sessions.getMemberId(socketId));
  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, socketId);

  const players: Record<string, NF4PlayerInfo> = {};

  if (isSolo) {
    players[s.player1.id] = playerToInfo(s.player1, ownsSolo);
    players[s.player2.id] = playerToInfo(s.player2, ownsSolo);
  } else {
    players[s.player1.id] = {
      ...playerToInfo(s.player1, isPlayer1),
      nickname: maskNick(s.player1.id, s.player1.nickname),
    };
    players[s.player2.id] = {
      ...playerToInfo(s.player2, isPlayer2),
      nickname: maskNick(s.player2.id, s.player2.nickname),
    };
    if (_dbg && (isPlayer1 || isPlayer2)) {
      const opp = isPlayer1 ? s.player2 : s.player1;
      players[opp.id] = { ...playerToInfo(opp, true), nickname: maskNick(opp.id, opp.nickname) };
    }
  }

  const base: NumberFourGameData = {
    round: s.round,
    phase: s.phase,
    players,
    revealData: null,
    ...(s.revealEndsAt !== null ? { revealEndsAt: s.revealEndsAt } : {}),
    roundHistory: toClientRoundHistory(
      s.roundHistory,
      new Set(ownsSolo ? [s.player1.id, s.player2.id] : [socketId]),
    ),
    winner: s.winner,
    winType: s.winType,
    tiebreakerReason: s.tiebreakerReason,
    currentSide: s.currentSide,
  };

  if (_dbg && (isPlayer1 || isPlayer2)) {
    const opp = isPlayer1 ? s.player2 : s.player1;
    const submitted =
      s.phase === 'submit' && opp.submitted
        ? {
            number: opp.submittedNumber,
            white: opp.submittedWhite,
            black: opp.submittedBlack,
          }
        : null;
    const revealed =
      s.phase === 'reveal' || s.phase === 'finished'
        ? s.roundHistory[s.roundHistory.length - 1]?.players[opp.id]
        : null;
    const payload =
      submitted ??
      (revealed ? { number: revealed.number, white: revealed.white, black: revealed.black } : null);
    if (payload) {
      return {
        ...base,
        _x: { opponentSubmitted: payload },
      };
    }
  }

  return base;
}

export function buildRevealGameData(s: InternalState, socketId: string): ProjectedNumberFourData {
  const data = buildGameDataForPlayer(s, socketId);
  if (s.tutorialData) return data;
  const lastHistory = s.roundHistory[s.roundHistory.length - 1];

  if (lastHistory) {
    const revealPlayers: Record<string, import('@shared/types/number4.js').NF4RevealPlayerData> =
      {};
    const lastLog = s.actionLog[s.actionLog.length - 1];

    for (const [pid, rec] of Object.entries(lastHistory.players)) {
      const logPlayer = lastLog?.players[pid];
      revealPlayers[pid] = {
        number: rec.number,
        success: rec.success,
        scoreChange: rec.scoreChange,
        conditionDetail: logPlayer?.conditionDetail ?? '',
      };
    }
    data.revealData = { players: revealPlayers };
  }

  return data;
}

export function buildGameState(s: InternalState, gameData: NumberFourGameData): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s),
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    // 착수를 기다리는 단계에서만 시계를 보낸다 (socket/gameClock.ts)
    turnStartedAt: inputPhaseClock(s.timeLimitSeconds, s.phase, ['submit'], s.turnStartedAt),
    gameData,
    activeSkin: getActiveSkin(s.roomId),
  };
}

/** 더미는 공개 정보와 자기 잔여 수만 사용한다. */
export function buildNumberFourDummyView(s: InternalState, viewerId: string) {
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    myId: me.id,
    oppId: opp.id,
    my: {
      score: me.score,
      remainingWhite: me.remainingWhite,
      remainingBlack: me.remainingBlack,
      submitted: me.submitted,
    },
    opp: {
      score: opp.score,
      submitted: opp.submitted,
    },
    roundHistory: toClientRoundHistory(s.roundHistory, new Set()),
    winner: s.winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}
