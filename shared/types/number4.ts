export const TILES_PER_ROUND = 7;
export const TOTAL_ROUNDS = 6;
export const NF4_REVEAL_DELAY_MS = 5000;
export const INITIAL_SCORE = 3;
export const INITIAL_WHITE = 22;
export const INITIAL_BLACK = 20;

/** 성공 시 넘버별 승점. 실패는 항상 -1. */
export const NF4_REWARDS: readonly [5, 1, 2, 3, 4] = [5, 1, 2, 3, 4];

export type NF4Phase = 'submit' | 'reveal' | 'finished';
export type NF4WinType = 'score' | 'elimination' | 'tiebreaker' | 'timeout' | 'draw';
export type NF4Number = 0 | 1 | 2 | 3 | 4;

export function isNf4Number(n: unknown): n is NF4Number {
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4;
}

export function nf4ScoreDelta(number: NF4Number, success: boolean): number {
  return success ? NF4_REWARDS[number] : -1;
}

export function nf4ApplyScore(score: number, number: NF4Number, success: boolean): number {
  return Math.max(0, score + nf4ScoreDelta(number, success));
}

/** 슈퍼 AI 자문. 내 타일·넘버는 알고, 상대 타일은 없다. 성공/실패는 이용자가 넣는다. */
export interface Nf4AdvisorRound {
  myWhite?: number;
  myBlack?: number;
  myNumber: NF4Number;
  oppNumber: NF4Number;
  mySuccess: boolean;
  oppSuccess: boolean;
}

export type Nf4AdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'ask-winner'; reason: string };

export interface Nf4AdvisorSnapshot {
  myScore: number;
  oppScore: number;
  myNumberSum: number;
  oppNumberSum: number;
  myWhiteLeft: number;
  myBlackLeft: number;
  tilesKnown: boolean;
  /** 다음에 둘 라운드(1~6). 끝나면 7. */
  round: number;
  result: Nf4AdvisorResult;
}

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

export interface NF4PlayerInfo {
  id: string;
  nickname: string;
  score: number;
  remainingWhite: number;
  remainingBlack: number;
  submitted: boolean;
  /** 본인에게만 전송하는 현재 라운드 제출 내용. */
  submission?: { white: number; black: number; number: NF4Number };
}

export interface NF4RevealPlayerData {
  number: NF4Number;
  success: boolean;
  scoreChange: number;
  conditionDetail: string;
}

export interface NF4RevealData {
  players: Record<string, NF4RevealPlayerData>;
}

export interface NF4RoundRecord {
  round: number;
  players: Record<
    string,
    {
      number: NF4Number;
      success: boolean;
      scoreChange: number;
      scoreAfter: number;
      /** 본인 기록에만 포함된다. 상대/관전자에게는 생략한다. */
      white?: number;
      black?: number;
    }
  >;
}

export interface NF4TutorialHint {
  step: 'intro' | 'choose' | 'result' | 'summary';
  title: string;
  body: string;
  expectedWhite?: number;
  expectedNumber?: NF4Number;
  ackLabel?: string;
}

export interface NumberFourGameData {
  tutorial?: NF4TutorialHint;
  round: number;
  phase: NF4Phase;
  /** 서버 기준 결과 공개 종료 시각. 튜토리얼은 자동 전환하지 않는다. */
  revealEndsAt?: number;
  players: Record<string, NF4PlayerInfo>;
  revealData: NF4RevealData | null;
  roundHistory: NF4RoundRecord[];
  winner: string | null;
  winType: NF4WinType | null;
  tiebreakerReason: string | null;
  currentSide: 'player1' | 'player2' | null;
}

export type NumberFourAction =
  | { type: 'tutorial-ack' }
  | { type: 'submit'; white: number; black: number; number: NF4Number };

export const NF4_ADVISOR_ME = 'me';
export const NF4_ADVISOR_OPP = 'opp';
export type Nf4AdvisorWinner = 'me' | 'opp';

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

export interface Nf4AdvisorKifuRoundPlayer {
  nickname: string;
  white?: number;
  black?: number;
  number: NF4Number;
  success: boolean;
  scoreChange: number;
  scoreBefore: number;
  scoreAfter: number;
  byAi?: boolean;
}

export interface Nf4AdvisorKifu {
  advisor: true;
  winType: NF4WinType;
  tiebreakerReason: string | null;
  finalScores: Record<string, number>;
  roundHistory: unknown[];
  actions: Array<{
    round: number;
    players: Record<string, Nf4AdvisorKifuRoundPlayer>;
  }>;
  players: Record<string, { nickname: string }>;
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
