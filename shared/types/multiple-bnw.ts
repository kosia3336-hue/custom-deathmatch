export const MBNW_TILE_SET = [3, 4, 5, 6, 7, 8, 9, 10, 12] as const;
export type MBNWTile = typeof MBNW_TILE_SET[number];
export const MBNW_TOTAL_ROUNDS = 9;

export type MBNWTileColor = 'white' | 'black';
export type MBNWPhase =
  | 'tileSubmit'
  | 'tileRespond'
  | 'suspectFirst'
  | 'suspectSecond'
  | 'result'
  | 'finished';
export type MBNWWinType = 'score' | 'suspectCount' | 'draw' | 'timeout' | 'abandon' | null;

export const MBNW_TILE_COLOR: Record<MBNWTile, MBNWTileColor> = {
  3: 'white', 5: 'white', 7: 'white', 9: 'white',
  4: 'black', 6: 'black', 8: 'black', 10: 'black', 12: 'black',
};

export interface MBNWPlayerInfo {
  id: string;
  nickname: string;
  score: number;
  /** 본인에게만 전달. 상대방 PlayerState에는 빈 배열 [] */
  remainingTiles: MBNWTile[];
  submitted: boolean;
  isFirst: boolean;
}

export interface MBNWColorReveal {
  firstPlayerColor: MBNWTileColor | null;
  secondPlayerColor: MBNWTileColor | null;
}

export interface MBNWSuspectResult {
  firstSuspected: boolean | null;
  firstSuccess: boolean | null;
  secondSkipped: boolean;
  secondSuspected: boolean | null;
  secondSuccess: boolean | null;
}

/** ⑤ 정산 페이즈 결과 — 타일 숫자 비공개 */
export interface MBNWResultPlayerData {
  color: MBNWTileColor;
  suspected: boolean;
  suspectSuccess: boolean | null;
  bonusPoint: number;
  /** 숫자 정산 승리 여부 (null = 의심으로 승부 결정 or 타이) */
  normalWin: boolean | null;
  normalPoint: number;
  totalScoreChange: number;
  scoreAfter: number;
}

export interface MBNWResultData {
  players: Record<string, MBNWResultPlayerData>;
}

/** 라운드 기록 — 상대 타일 숫자는 비공개, 색상만 기록. 숫자는 본인 것만 실린다. */
export interface MBNWRoundRecord {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    color: MBNWTileColor;
    /** 내가 낸 타일 숫자. 받는 사람 본인 칸에만 있고 상대·관전자에게는 없다. */
    tile?: number;
    suspected: boolean;
    suspectSuccess: boolean | null;
    bonusPoint: number;
    normalPoint: number;
    scoreAfter: number;
  }>;
}

export interface MultipleBnwGameData {
  round: number;
  phase: MBNWPhase;
  firstPlayerId: string;
  players: Record<string, MBNWPlayerInfo>;
  colorReveal: MBNWColorReveal | null;
  suspectResult: MBNWSuspectResult | null;
  resultData: MBNWResultData | null;
  roundHistory: MBNWRoundRecord[];
  winner: string | null;
  winType: MBNWWinType;
  /** 의심 페이즈에서 내 타일 숫자 (본인에게만 전송) */
  myTile: number | null;
}

export type MultipleBnwAction =
  | { type: 'submitTile'; tile: number }
  | { type: 'respondTile'; tile: number }
  | { type: 'suspectFirst'; suspect: boolean }
  | { type: 'suspectSecond'; suspect: boolean };

export function mbnwIsTile(n: unknown): n is MBNWTile {
  return (MBNW_TILE_SET as readonly number[]).includes(n as number);
}

export function mbnwIsColor(v: unknown): v is MBNWTileColor {
  return v === 'white' || v === 'black';
}

/** 상대 타일이 내 타일의 배수인지. 같은 숫자도 성공. */
export function mbnwIsMultiple(myTile: number, opTile: number): boolean {
  return opTile % myTile === 0;
}

export type MbnwCmp = 'me' | 'opp' | 'tie';

/** 슈퍼 AI 자문. 내 타일은 알고, 상대 숫자는 없다. 색·의심·크기는 이용자가 넣는다. */
export interface MbnwAdvisorRound {
  iWasFirst: boolean;
  myTile: MBNWTile;
  oppColor: MBNWTileColor;
  mySuspected: boolean;
  mySuccess: boolean | null;
  oppSuspected: boolean;
  oppSuccess: boolean | null;
  /** 선플 의심 성공으로 후플 의심이 건너뛰어졌는가 */
  secondSkipped: boolean;
  /** 의심 성공자가 없을 때만. 숫자 정산. */
  cmp: MbnwCmp | null;
}

export interface MbnwAdvisorPending {
  oppColor?: MBNWTileColor;
  myTile?: MBNWTile;
  /** 후플일 때 선플 의심. */
  firstSuspect?: 'none' | 'success' | 'fail';
}

export type MbnwAdvisorAsk =
  | 'tile'
  | 'suspect'
  | 'need-opp-color'
  | 'need-first-suspect'
  | 'finished';

export type MbnwAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface MbnwAdvisorSnapshot {
  round: number;
  myScore: number;
  oppScore: number;
  mySuspectWins: number;
  oppSuspectWins: number;
  myTiles: MBNWTile[];
  iAmFirst: boolean;
  result: MbnwAdvisorResult;
}

export interface MbnwRoundDelta {
  myDelta: number;
  oppDelta: number;
  mySuspectWin: boolean;
  oppSuspectWin: boolean;
  nextIAmFirst: boolean;
}

export function mbnwSettleAdvisorRound(rec: MbnwAdvisorRound): MbnwRoundDelta {
  const firstIsMe = rec.iWasFirst;
  const firstSuspected = firstIsMe ? rec.mySuspected : rec.oppSuspected;
  const firstSuccess = firstIsMe ? rec.mySuccess : rec.oppSuccess;
  const secondSuspected = firstIsMe ? rec.oppSuspected : rec.mySuspected;
  const secondSuccess = firstIsMe ? rec.oppSuccess : rec.mySuccess;

  let firstBonus = 0;
  let secondBonus = 0;
  let firstNormal = 0;
  let secondNormal = 0;
  let suspectWinner: 'first' | 'second' | null = null;

  if (firstSuspected) {
    if (firstSuccess) suspectWinner = 'first';
    else secondBonus += 1;
  }
  if (!rec.secondSkipped && secondSuspected) {
    if (secondSuccess) suspectWinner = 'second';
    else firstBonus += 1;
  }

  if (suspectWinner === 'first') firstNormal = 1;
  else if (suspectWinner === 'second') secondNormal = 1;
  else if (rec.cmp === 'me') {
    if (firstIsMe) firstNormal = 1;
    else secondNormal = 1;
  } else if (rec.cmp === 'opp') {
    if (firstIsMe) secondNormal = 1;
    else firstNormal = 1;
  }

  const firstDelta = firstBonus + firstNormal;
  const secondDelta = secondBonus + secondNormal;
  let nextIAmFirst = rec.iWasFirst;
  if (firstNormal > 0) nextIAmFirst = firstIsMe;
  else if (secondNormal > 0) nextIAmFirst = !firstIsMe;

  return {
    myDelta: firstIsMe ? firstDelta : secondDelta,
    oppDelta: firstIsMe ? secondDelta : firstDelta,
    mySuspectWin: suspectWinner === (firstIsMe ? 'first' : 'second'),
    oppSuspectWin: suspectWinner === (firstIsMe ? 'second' : 'first'),
    nextIAmFirst,
  };
}

export function mbnwRemainingTiles(history: MbnwAdvisorRound[]): MBNWTile[] {
  const used = new Set(history.map((r) => r.myTile));
  return MBNW_TILE_SET.filter((t) => !used.has(t));
}

export function mbnwAdvisorSnapshot(
  iAmFirstStart: boolean,
  history: MbnwAdvisorRound[],
): MbnwAdvisorSnapshot {
  let myScore = 0;
  let oppScore = 0;
  let mySuspectWins = 0;
  let oppSuspectWins = 0;
  let iAmFirst = iAmFirstStart;

  for (const rec of history) {
    const s = mbnwSettleAdvisorRound(rec);
    myScore += s.myDelta;
    oppScore += s.oppDelta;
    if (s.mySuspectWin) mySuspectWins += 1;
    if (s.oppSuspectWin) oppSuspectWins += 1;
    iAmFirst = s.nextIAmFirst;
  }

  const myTiles = mbnwRemainingTiles(history);
  const played = history.length;
  if (played >= MBNW_TOTAL_ROUNDS) {
    const round = MBNW_TOTAL_ROUNDS + 1;
    if (myScore > oppScore) {
      return finishSnap(round, myScore, oppScore, mySuspectWins, oppSuspectWins, myTiles, false, 'win', `점수 ${myScore} vs ${oppScore}`);
    }
    if (myScore < oppScore) {
      return finishSnap(round, myScore, oppScore, mySuspectWins, oppSuspectWins, myTiles, false, 'loss', `점수 ${myScore} vs ${oppScore}`);
    }
    if (mySuspectWins > oppSuspectWins) {
      return finishSnap(round, myScore, oppScore, mySuspectWins, oppSuspectWins, myTiles, false, 'win', `의심 ${mySuspectWins} vs ${oppSuspectWins}`);
    }
    if (mySuspectWins < oppSuspectWins) {
      return finishSnap(round, myScore, oppScore, mySuspectWins, oppSuspectWins, myTiles, false, 'loss', `의심 ${mySuspectWins} vs ${oppSuspectWins}`);
    }
    return finishSnap(round, myScore, oppScore, mySuspectWins, oppSuspectWins, myTiles, false, 'draw', `점수 ${myScore} 의심 ${mySuspectWins} 동점`);
  }

  return {
    round: played + 1,
    myScore,
    oppScore,
    mySuspectWins,
    oppSuspectWins,
    myTiles,
    iAmFirst,
    result: { kind: 'playing' },
  };
}

function finishSnap(
  round: number,
  myScore: number,
  oppScore: number,
  mySuspectWins: number,
  oppSuspectWins: number,
  myTiles: MBNWTile[],
  iAmFirst: boolean,
  kind: 'win' | 'loss' | 'draw',
  reason: string,
): MbnwAdvisorSnapshot {
  return {
    round,
    myScore,
    oppScore,
    mySuspectWins,
    oppSuspectWins,
    myTiles,
    iAmFirst,
    result: { kind, reason },
  };
}

export function mbnwAdvisorAsk(
  iAmFirstStart: boolean,
  history: MbnwAdvisorRound[],
  pending?: MbnwAdvisorPending | null,
): MbnwAdvisorAsk {
  const snap = mbnwAdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') return 'finished';
  const p = pending ?? {};
  if (p.myTile == null) {
    if (!snap.iAmFirst && p.oppColor == null) return 'need-opp-color';
    return 'tile';
  }
  if (snap.iAmFirst) {
    if (p.oppColor == null) return 'need-opp-color';
    return 'suspect';
  }
  if (p.firstSuspect == null) return 'need-first-suspect';
  return 'suspect';
}

export function mbnwAdvisorFinished(result: MbnwAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export type MbnwAdvisorWinner = 'me' | 'opp' | 'draw';

export function mbnwAdvisorWinnerFromResult(result: MbnwAdvisorResult): MbnwAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export const MBNW_ADVISOR_ME = 'me';
export const MBNW_ADVISOR_OPP = 'opp';

export interface MbnwAdvisorKifu {
  advisor: true;
  winType: MBNWWinType;
  finalScores: Record<string, number>;
  actions: Array<{
    round: number;
    firstPlayerId: string;
    players: Record<string, {
      nickname: string;
      tile: number;
      tileColor: MBNWTileColor;
      suspected: boolean;
      suspectSuccess: boolean | null;
      suspectDetail: string | null;
      bonusPoint: number;
      normalPoint: number;
      totalScoreChange: number;
      scoreBefore: number;
      scoreAfter: number;
      byAi?: boolean;
    }>;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildMbnwAdvisorKifu(opts: {
  history: MbnwAdvisorRound[];
  iAmFirstStart: boolean;
  myNickname: string;
  result: MbnwAdvisorResult;
}): MbnwAdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  let myScore = 0;
  let oppScore = 0;
  const actions: MbnwAdvisorKifu['actions'] = [];

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    const myBefore = myScore;
    const oppBefore = oppScore;
    const settled = mbnwSettleAdvisorRound(rec);
    myScore += settled.myDelta;
    oppScore += settled.oppDelta;
    const firstId = rec.iWasFirst ? MBNW_ADVISOR_ME : MBNW_ADVISOR_OPP;
    actions.push({
      round: i + 1,
      firstPlayerId: firstId,
      players: {
        me: {
          nickname: myNick,
          tile: rec.myTile,
          tileColor: MBNW_TILE_COLOR[rec.myTile],
          suspected: rec.mySuspected,
          suspectSuccess: rec.mySuccess,
          suspectDetail: null,
          bonusPoint: 0,
          normalPoint: settled.myDelta,
          totalScoreChange: settled.myDelta,
          scoreBefore: myBefore,
          scoreAfter: myScore,
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          tile: 0,
          tileColor: rec.oppColor,
          suspected: rec.oppSuspected,
          suspectSuccess: rec.oppSuccess,
          suspectDetail: null,
          bonusPoint: 0,
          normalPoint: settled.oppDelta,
          totalScoreChange: settled.oppDelta,
          scoreBefore: oppBefore,
          scoreAfter: oppScore,
        },
      },
    });
  }

  const finishedReason = opts.result.kind === 'win' || opts.result.kind === 'loss' ? opts.result.reason : '';
  const winType: MBNWWinType =
    opts.result.kind === 'draw'
      ? 'draw'
      : finishedReason.includes('의심')
        ? 'suspectCount'
        : 'score';

  return {
    advisor: true,
    winType,
    finalScores: { me: myScore, opp: oppScore },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}
