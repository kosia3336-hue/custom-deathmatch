/** 슈퍼 AI 자문 계산과 기보. 소켓·서버 상태에 의존하지 않는다. */
import {
  INITIAL_SCORE,
  INITIAL_WHITE,
  INITIAL_BLACK,
  TOTAL_ROUNDS,
  NF4_ADVISOR_ME,
  NF4_ADVISOR_OPP,
  nf4ApplyScore,
  nf4ScoreDelta,
  type Nf4AdvisorRound,
  type Nf4AdvisorSnapshot,
  type Nf4AdvisorResult,
  type Nf4AdvisorWinner,
  type NF4WinType,
  type Nf4AdvisorKifu,
} from './types/number4';
export type {
  Nf4AdvisorRound,
  Nf4AdvisorSnapshot,
  Nf4AdvisorResult,
  Nf4AdvisorWinner,
  Nf4AdvisorKifu,
} from './types/number4';

export function nf4AdvisorSnapshot(history: Nf4AdvisorRound[]): Nf4AdvisorSnapshot {
  let myScore = INITIAL_SCORE;
  let oppScore = INITIAL_SCORE;
  let myNumberSum = 0;
  let oppNumberSum = 0;
  let myWhiteLeft = INITIAL_WHITE;
  let myBlackLeft = INITIAL_BLACK;
  let tilesKnown = true;

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    myScore = nf4ApplyScore(myScore, rec.myNumber, rec.mySuccess);
    oppScore = nf4ApplyScore(oppScore, rec.oppNumber, rec.oppSuccess);
    myNumberSum += rec.myNumber;
    oppNumberSum += rec.oppNumber;
    if (typeof rec.myWhite === 'number' && typeof rec.myBlack === 'number') {
      myWhiteLeft -= rec.myWhite;
      myBlackLeft -= rec.myBlack;
    } else {
      tilesKnown = false;
    }
    const played = i + 1;

    if (myScore === 0 && oppScore === 0) {
      if (myNumberSum !== oppNumberSum) {
        return finish(
          myScore,
          oppScore,
          myNumberSum,
          oppNumberSum,
          myWhiteLeft,
          myBlackLeft,
          tilesKnown,
          played,
          myNumberSum < oppNumberSum ? 'win' : 'loss',
          `넘버 합 ${myNumberSum} vs ${oppNumberSum} (낮은 쪽 승리)`,
        );
      }
      return {
        myScore,
        oppScore,
        myNumberSum,
        oppNumberSum,
        myWhiteLeft,
        myBlackLeft,
        tilesKnown,
        round: played + 1,
        result: {
          kind: 'ask-winner',
          reason: '둘 다 0점이고 넘버 합도 같다. 백 총수는 모르니 누가 이겼는지 고른다.',
        },
      };
    }
    if (myScore === 0) {
      return finish(
        myScore,
        oppScore,
        myNumberSum,
        oppNumberSum,
        myWhiteLeft,
        myBlackLeft,
        tilesKnown,
        played,
        'loss',
        '승점 0 탈락',
      );
    }
    if (oppScore === 0) {
      return finish(
        myScore,
        oppScore,
        myNumberSum,
        oppNumberSum,
        myWhiteLeft,
        myBlackLeft,
        tilesKnown,
        played,
        'win',
        '상대 승점 0 탈락',
      );
    }
    if (played >= TOTAL_ROUNDS) {
      if (myScore !== oppScore) {
        return finish(
          myScore,
          oppScore,
          myNumberSum,
          oppNumberSum,
          myWhiteLeft,
          myBlackLeft,
          tilesKnown,
          played,
          myScore > oppScore ? 'win' : 'loss',
          `승점 ${myScore} vs ${oppScore}`,
        );
      }
      if (myNumberSum !== oppNumberSum) {
        return finish(
          myScore,
          oppScore,
          myNumberSum,
          oppNumberSum,
          myWhiteLeft,
          myBlackLeft,
          tilesKnown,
          played,
          myNumberSum < oppNumberSum ? 'win' : 'loss',
          `넘버 합 ${myNumberSum} vs ${oppNumberSum} (낮은 쪽 승리)`,
        );
      }
      return {
        myScore,
        oppScore,
        myNumberSum,
        oppNumberSum,
        myWhiteLeft,
        myBlackLeft,
        tilesKnown,
        round: played + 1,
        result: {
          kind: 'ask-winner',
          reason: '승점과 넘버 합이 같다. 백 총수는 모르니 누가 이겼는지 고른다.',
        },
      };
    }
  }

  return {
    myScore,
    oppScore,
    myNumberSum,
    oppNumberSum,
    myWhiteLeft,
    myBlackLeft,
    tilesKnown,
    round: history.length + 1,
    result: { kind: 'playing' },
  };
}

function finish(
  myScore: number,
  oppScore: number,
  myNumberSum: number,
  oppNumberSum: number,
  myWhiteLeft: number,
  myBlackLeft: number,
  tilesKnown: boolean,
  played: number,
  kind: 'win' | 'loss',
  reason: string,
): Nf4AdvisorSnapshot {
  return {
    myScore,
    oppScore,
    myNumberSum,
    oppNumberSum,
    myWhiteLeft,
    myBlackLeft,
    tilesKnown,
    round: played + 1,
    result: { kind, reason },
  };
}

export function nf4AdvisorFinished(
  result: Nf4AdvisorResult,
  winner: Nf4AdvisorWinner | null | undefined,
): boolean {
  if (result.kind === 'win' || result.kind === 'loss') return true;
  return result.kind === 'ask-winner' && (winner === 'me' || winner === 'opp');
}

export function nf4AdvisorWinnerFromResult(
  result: Nf4AdvisorResult,
  picked: Nf4AdvisorWinner | null | undefined,
): Nf4AdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'ask-winner' && (picked === 'me' || picked === 'opp')) return picked;
  return null;
}

export function nf4AdvisorWinType(result: Nf4AdvisorResult): NF4WinType {
  if (result.kind === 'playing') return 'score';
  if (result.kind === 'ask-winner') return 'tiebreaker';
  if (result.reason.includes('탈락')) return 'elimination';
  if (result.reason.includes('넘버 합')) return 'tiebreaker';
  return 'score';
}

export function buildNf4AdvisorKifu(opts: {
  history: Nf4AdvisorRound[];
  myNickname: string;
  winner: Nf4AdvisorWinner;
  result: Nf4AdvisorResult;
}): Nf4AdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  let myScore = INITIAL_SCORE;
  let oppScore = INITIAL_SCORE;
  const actions: Nf4AdvisorKifu['actions'] = [];

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    const myBefore = myScore;
    const oppBefore = oppScore;
    const myDelta = nf4ScoreDelta(rec.myNumber, rec.mySuccess);
    const oppDelta = nf4ScoreDelta(rec.oppNumber, rec.oppSuccess);
    myScore = nf4ApplyScore(myScore, rec.myNumber, rec.mySuccess);
    oppScore = nf4ApplyScore(oppScore, rec.oppNumber, rec.oppSuccess);
    actions.push({
      round: i + 1,
      players: {
        [NF4_ADVISOR_ME]: {
          nickname: myNick,
          white: rec.myWhite,
          black: rec.myBlack,
          number: rec.myNumber,
          success: rec.mySuccess,
          scoreChange: myDelta,
          scoreBefore: myBefore,
          scoreAfter: myScore,
          byAi: true,
        },
        [NF4_ADVISOR_OPP]: {
          nickname: oppNick,
          number: rec.oppNumber,
          success: rec.oppSuccess,
          scoreChange: oppDelta,
          scoreBefore: oppBefore,
          scoreAfter: oppScore,
        },
      },
    });
  }

  const winType = nf4AdvisorWinType(opts.result);
  return {
    advisor: true,
    winType,
    tiebreakerReason:
      winType === 'tiebreaker'
        ? opts.result.kind === 'playing'
          ? null
          : opts.result.reason
        : null,
    finalScores: { [NF4_ADVISOR_ME]: myScore, [NF4_ADVISOR_OPP]: oppScore },
    roundHistory: actions.map((a) => ({
      round: a.round,
      players: {
        [NF4_ADVISOR_ME]: {
          number: a.players[NF4_ADVISOR_ME]!.number,
          success: a.players[NF4_ADVISOR_ME]!.success,
          scoreChange: a.players[NF4_ADVISOR_ME]!.scoreChange,
          scoreAfter: a.players[NF4_ADVISOR_ME]!.scoreAfter,
        },
        [NF4_ADVISOR_OPP]: {
          number: a.players[NF4_ADVISOR_OPP]!.number,
          success: a.players[NF4_ADVISOR_OPP]!.success,
          scoreChange: a.players[NF4_ADVISOR_OPP]!.scoreChange,
          scoreAfter: a.players[NF4_ADVISOR_OPP]!.scoreAfter,
        },
      },
    })),
    actions,
    players: {
      [NF4_ADVISOR_ME]: { nickname: myNick },
      [NF4_ADVISOR_OPP]: { nickname: oppNick },
    },
  };
}
