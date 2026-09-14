export const SBNW_MAX_SCORE = 6;
export const SBNW_TOTAL_ROUNDS = 11;
export const SBNW_MAX_REMATCH = 5;
export const SBNW_TOTAL_TILE_COUNT = 19;

export type SBNWTile = 0 | 1 | 2 | 3 | 4;

export const SBNW_INITIAL_TILES: Record<SBNWTile, number> = {
  0: 6,
  1: 5,
  2: 4,
  3: 3,
  4: 1,
};

export type SBNWPhase =
  | 'firstSubmit'
  | 'secondSubmit'
  | 'reveal'
  | 'rematchIntro'
  | 'finished';

export type SBNWWinType =
  /** 선승 점수(SBNW_MAX_SCORE)를 먼저 채워서 이김 */
  | 'score'
  /** 라운드를 다 치른 뒤 승점이 더 높아서 이김 — 'score' 와 문구가 달라야 한다 */
  | 'roundsScore'
  | 'tiebreakTile'
  | 'rematch'
  | 'autoLoss'
  | 'timeout'
  | 'leave'
  | 'draw';

export interface SBNWFirstHint {
  digits: number;
}

export interface SBNWPlayerInfo {
  id: string;
  nickname: string;
  score: number;
  /** 본인에게만 공개. 상대/관전자는 null */
  tiles: Record<SBNWTile, number> | null;
  tileCount: number;
  submitted: boolean;
}

export interface SBNWRevealSide {
  tilesUsed: SBNWTile[];
  digits: number;
  /** bigint를 직렬화한 문자열 */
  valueStr: string;
}

export interface SBNWRevealData {
  firstPlayerId: string;
  first: SBNWRevealSide;
  second: SBNWRevealSide;
  winnerId: string | null;
}

export interface SBNWRoundPlayerRecord {
  nickname: string;
  tilesUsed: SBNWTile[];
  digits: number;
  valueStr: string;
  scoreBefore: number;
  scoreAfter: number;
  scoreChange: number;
  tileCountBefore: number;
  tileCountAfter: number;
}

export interface SBNWRoundRecord {
  round: number;
  rematchIndex: number;
  firstPlayerId: string;
  players: Record<string, SBNWRoundPlayerRecord>;
  winnerId: string | null;
}

export type SBNWSegmentResolution =
  | 'continuing'
  | 'score'
  | 'tiebreakTile'
  | 'rematchNeeded';

export interface SBNWSegmentSummary {
  rematchIndex: number;
  firstPlayerIdAtStart: string;
  finalScores: Record<string, number>;
  finalTiles: Record<string, Record<SBNWTile, number>>;
  resolution: SBNWSegmentResolution;
  winnerId: string | null;
  rounds: SBNWRoundRecord[];
}

export interface SBNWGameData {
  phase: SBNWPhase;
  round: number;
  firstPlayerId: string;
  players: Record<string, SBNWPlayerInfo>;
  /** secondSubmit 이상에서만 존재 */
  firstHint: SBNWFirstHint | null;
  /** reveal/rematchIntro/finished 단계에서만 존재 */
  revealData: SBNWRevealData | null;
  /** 현재 세그먼트 라운드 기록 */
  roundHistory: SBNWRoundRecord[];
  /** 과거 세그먼트 누적 (rematchIndex ≥ 1일 때) */
  segmentsHistory: SBNWSegmentSummary[];
  /** 0=본경기, 1+=재대결 회차 */
  rematchIndex: number;
  finishReason: string | null;
  winner: string | null;
  winType: SBNWWinType | null;
}

export type SBNWAction =
  | { type: 'submitFirst'; tiles: SBNWTile[] }
  | { type: 'submitSecond'; tiles: SBNWTile[] };

export const SBNW_TILES: SBNWTile[] = [0, 1, 2, 3, 4];

export function sbnwPoolCopy(p: Record<SBNWTile, number>): Record<SBNWTile, number> {
  return { 0: p[0] ?? 0, 1: p[1] ?? 0, 2: p[2] ?? 0, 3: p[3] ?? 0, 4: p[4] ?? 0 };
}

export function sbnwEmptyPool(): Record<SBNWTile, number> {
  return sbnwPoolCopy(SBNW_INITIAL_TILES);
}

export function sbnwPoolTotal(p: Record<SBNWTile, number>): number {
  return (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0) + (p[3] ?? 0) + (p[4] ?? 0);
}

export function sbnwMaxTile(p: Record<SBNWTile, number>): number {
  for (let t = 4; t >= 0; t--) {
    if ((p[t as SBNWTile] ?? 0) > 0) return t;
  }
  return -1;
}

export function sbnwCanSubmit(p: Record<SBNWTile, number>): boolean {
  return sbnwPoolTotal(p) > 0;
}

export function sbnwValidateTiles(
  tiles: SBNWTile[],
  pool: Record<SBNWTile, number>,
): boolean {
  if (!Array.isArray(tiles) || tiles.length === 0) return false;
  for (const t of tiles) {
    if (!Number.isInteger(t) || t < 0 || t > 4) return false;
  }
  if (tiles.length >= 2 && tiles[0] === 0) return false;
  const need: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const t of tiles) need[t] = (need[t] ?? 0) + 1;
  for (const k of SBNW_TILES) {
    if ((pool[k] ?? 0) < need[k]) return false;
  }
  return true;
}

export function sbnwTilesToValue(tiles: SBNWTile[]): bigint {
  let v = 0n;
  for (const t of tiles) v = v * 10n + BigInt(t);
  return v;
}

export function sbnwConsume(
  pool: Record<SBNWTile, number>,
  tiles: SBNWTile[],
): Record<SBNWTile, number> {
  const next = sbnwPoolCopy(pool);
  for (const t of tiles) next[t] -= 1;
  return next;
}

export function sbnwCheapestFold(p: Record<SBNWTile, number>): SBNWTile[] {
  for (const t of SBNW_TILES) {
    if ((p[t] ?? 0) > 0) return [t];
  }
  return [];
}

/** 자리 늘리기: 1 다음에 0. 기보 10 / 100. */
export function sbnwMinExtraDigits(
  p: Record<SBNWTile, number>,
  digits: number,
): SBNWTile[] | null {
  if (digits <= 0 || sbnwPoolTotal(p) < digits) return null;
  const local = sbnwPoolCopy(p);
  const out: SBNWTile[] = [];
  let lead: SBNWTile | null = null;
  for (const t of [1, 2, 3, 4] as SBNWTile[]) {
    if (local[t] > 0) {
      lead = t;
      break;
    }
  }
  if (lead == null) return null;
  local[lead] -= 1;
  out.push(lead);
  for (let i = 1; i < digits; i++) {
    let picked: SBNWTile | null = null;
    for (const t of SBNW_TILES) {
      if (local[t] > 0) {
        picked = t;
        break;
      }
    }
    if (picked == null) return null;
    local[picked] -= 1;
    out.push(picked);
  }
  return out;
}

export function sbnwMaxDigits(
  p: Record<SBNWTile, number>,
  digits: number,
): SBNWTile[] | null {
  if (digits <= 0 || sbnwPoolTotal(p) < digits) return null;
  const local = sbnwPoolCopy(p);
  const out: SBNWTile[] = [];
  let lead: SBNWTile | null = null;
  for (const t of [4, 3, 2, 1] as SBNWTile[]) {
    if (local[t] > 0) {
      lead = t;
      break;
    }
  }
  if (lead == null) return null;
  local[lead] -= 1;
  out.push(lead);
  for (let i = 1; i < digits; i++) {
    let picked: SBNWTile | null = null;
    for (const t of [4, 3, 2, 1, 0] as SBNWTile[]) {
      if (local[t] > 0) {
        picked = t;
        break;
      }
    }
    if (picked == null) return null;
    local[picked] -= 1;
    out.push(picked);
  }
  return out;
}

export type SbnwScoreRace = 'won' | 'lost' | null;

/** 이번 라운드 포함 전승/전패해도 점수 레이스가 끝나면 사고할 필요 없다. */
export function sbnwScoreRace(
  myScore: number,
  oppScore: number,
  roundsLeft: number,
): SbnwScoreRace {
  const left = Math.max(0, roundsLeft);
  if (myScore >= SBNW_MAX_SCORE) return 'won';
  if (oppScore >= SBNW_MAX_SCORE) return 'lost';
  if (myScore + left < oppScore) return 'lost';
  if (oppScore + left < myScore) return 'won';
  return null;
}

/** 남은 라운드마다 1장은 남긴다. 이번이 6점이면 예외. */
export function sbnwMaxSpend(tileCount: number, roundsLeft: number, wouldWinGame: boolean): number {
  if (wouldWinGame) return tileCount;
  if (roundsLeft <= 1) return tileCount;
  return Math.max(1, tileCount - (roundsLeft - 1));
}

export const SBNW_ADVISOR_ME = 'me';
export const SBNW_ADVISOR_OPP = 'opp';

export interface SbnwAdvisorRound {
  rematchIndex: number;
  iWasFirst: boolean;
  myTiles: SBNWTile[];
  oppTiles: SBNWTile[];
}

export type SbnwAdvisorPending = {
  firstDigits?: number;
};

export type SbnwAdvisorAsk = 'first-bid' | 'need-first-digits' | 'second-bid' | 'finished';

export type SbnwAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface SbnwAdvisorSide {
  score: number;
  tiles: Record<SBNWTile, number>;
  tileCount: number;
}

export interface SbnwAdvisorSnapshot {
  round: number;
  rematchIndex: number;
  roundsLeft: number;
  iAmFirst: boolean;
  my: SbnwAdvisorSide;
  opp: SbnwAdvisorSide;
  result: SbnwAdvisorResult;
  winType: SBNWWinType | null;
}

export type SbnwAdvisorWinner = 'me' | 'opp' | 'draw';

function sideOf(score: number, tiles: Record<SBNWTile, number>): SbnwAdvisorSide {
  return { score, tiles: sbnwPoolCopy(tiles), tileCount: sbnwPoolTotal(tiles) };
}

function finishByEnd(
  myScore: number,
  oppScore: number,
  myTiles: Record<SBNWTile, number>,
  oppTiles: Record<SBNWTile, number>,
  rematchIndex: number,
): { result: SbnwAdvisorResult; winType: SBNWWinType } | null {
  if (myScore > oppScore) {
    return {
      result: { kind: 'win', reason: rematchIndex > 0 ? '재대결 점수' : '11라운드 점수' },
      winType: rematchIndex > 0 ? 'rematch' : 'roundsScore',
    };
  }
  if (myScore < oppScore) {
    return {
      result: { kind: 'loss', reason: rematchIndex > 0 ? '재대결 점수' : '11라운드 점수' },
      winType: rematchIndex > 0 ? 'rematch' : 'roundsScore',
    };
  }
  const myMax = sbnwMaxTile(myTiles);
  const oppMax = sbnwMaxTile(oppTiles);
  if (myMax > oppMax) {
    return { result: { kind: 'win', reason: '잔여 타일 최댓값' }, winType: 'tiebreakTile' };
  }
  if (myMax < oppMax) {
    return { result: { kind: 'loss', reason: '잔여 타일 최댓값' }, winType: 'tiebreakTile' };
  }
  if (rematchIndex + 1 > SBNW_MAX_REMATCH) {
    return { result: { kind: 'draw', reason: '재대결 한도' }, winType: 'draw' };
  }
  return null;
}

export function sbnwAdvisorSnapshot(
  iAmFirstStart: boolean,
  history: SbnwAdvisorRound[],
): SbnwAdvisorSnapshot {
  let rematchIndex = 0;
  let iAmFirst = iAmFirstStart;
  let myScore = 0;
  let oppScore = 0;
  let myTiles = sbnwEmptyPool();
  let oppTiles = sbnwEmptyPool();
  let roundInSeg = 1;

  const playing = (): SbnwAdvisorSnapshot => ({
    round: roundInSeg,
    rematchIndex,
    roundsLeft: Math.max(0, SBNW_TOTAL_ROUNDS - roundInSeg + 1),
    iAmFirst,
    my: sideOf(myScore, myTiles),
    opp: sideOf(oppScore, oppTiles),
    result: { kind: 'playing' },
    winType: null,
  });

  const done = (
    result: SbnwAdvisorResult,
    winType: SBNWWinType,
  ): SbnwAdvisorSnapshot => ({
    round: roundInSeg,
    rematchIndex,
    roundsLeft: 0,
    iAmFirst,
    my: sideOf(myScore, myTiles),
    opp: sideOf(oppScore, oppTiles),
    result,
    winType,
  });

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    if (rec.rematchIndex > rematchIndex) {
      rematchIndex = rec.rematchIndex;
      myScore = 0;
      oppScore = 0;
      myTiles = sbnwEmptyPool();
      oppTiles = sbnwEmptyPool();
      roundInSeg = 1;
    }
    iAmFirst = rec.iWasFirst;
    if (!sbnwValidateTiles(rec.myTiles, myTiles) || !sbnwValidateTiles(rec.oppTiles, oppTiles)) {
      return done({ kind: 'loss', reason: '기록 타일이 올바르지 않음' }, 'autoLoss');
    }
    const myV = sbnwTilesToValue(rec.myTiles);
    const oppV = sbnwTilesToValue(rec.oppTiles);
    myTiles = sbnwConsume(myTiles, rec.myTiles);
    oppTiles = sbnwConsume(oppTiles, rec.oppTiles);
    if (myV > oppV) {
      myScore += 1;
      iAmFirst = true;
    } else if (oppV > myV) {
      oppScore += 1;
      iAmFirst = false;
    } else {
      iAmFirst = rec.iWasFirst;
    }

    if (myScore >= SBNW_MAX_SCORE) {
      return done({ kind: 'win', reason: '6선승' }, rematchIndex > 0 ? 'rematch' : 'score');
    }
    if (oppScore >= SBNW_MAX_SCORE) {
      return done({ kind: 'loss', reason: '상대 6선승' }, rematchIndex > 0 ? 'rematch' : 'score');
    }

    roundInSeg += 1;
    const myCan = sbnwCanSubmit(myTiles);
    const oppCan = sbnwCanSubmit(oppTiles);
    if (!myCan && !oppCan) {
      const end = finishByEnd(myScore, oppScore, myTiles, oppTiles, rematchIndex);
      if (end) return done(end.result, end.winType);
      rematchIndex += 1;
      myScore = 0;
      oppScore = 0;
      myTiles = sbnwEmptyPool();
      oppTiles = sbnwEmptyPool();
      roundInSeg = 1;
      iAmFirst = !rec.iWasFirst;
      continue;
    }
    if (!myCan) {
      return done({ kind: 'loss', reason: '타일 소진' }, 'autoLoss');
    }
    if (!oppCan) {
      return done({ kind: 'win', reason: '상대 타일 소진' }, 'autoLoss');
    }

    if (roundInSeg > SBNW_TOTAL_ROUNDS) {
      const end = finishByEnd(myScore, oppScore, myTiles, oppTiles, rematchIndex);
      if (end) return done(end.result, end.winType);
      rematchIndex += 1;
      myScore = 0;
      oppScore = 0;
      myTiles = sbnwEmptyPool();
      oppTiles = sbnwEmptyPool();
      roundInSeg = 1;
      iAmFirst = !rec.iWasFirst;
    }
  }

  return playing();
}

export function sbnwAdvisorAsk(
  iAmFirstStart: boolean,
  history: SbnwAdvisorRound[],
  pending?: SbnwAdvisorPending | null,
): SbnwAdvisorAsk {
  const snap = sbnwAdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') return 'finished';
  if (snap.iAmFirst) return 'first-bid';
  if (pending?.firstDigits == null) return 'need-first-digits';
  return 'second-bid';
}

export function sbnwAdvisorFinished(result: SbnwAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function sbnwAdvisorWinnerFromResult(result: SbnwAdvisorResult): SbnwAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export function sbnwAdvisorHopeless(snap: SbnwAdvisorSnapshot, side: 'my' | 'opp'): boolean {
  const me = side === 'my' ? snap.my : snap.opp;
  const them = side === 'my' ? snap.opp : snap.my;
  return sbnwScoreRace(me.score, them.score, snap.roundsLeft) === 'lost';
}

export interface SbnwAdvisorKifu {
  advisor: true;
  iAmFirstStart: boolean;
  winType: SBNWWinType | null;
  finishReason: string | null;
  finalScores: Record<string, number>;
  finalTiles: Record<string, Record<SBNWTile, number>>;
  actions: Array<{
    round: number;
    rematchIndex: number;
    firstPlayerId: string;
    players: Record<string, {
      nickname: string;
      tilesUsed: SBNWTile[];
      digits: number;
      valueStr: string;
      scoreChange: number;
      scoreBefore: number;
      scoreAfter: number;
      tileCountBefore: number;
      tileCountAfter: number;
      byAi?: boolean;
    }>;
    winnerId: string | null;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildSbnwAdvisorKifu(opts: {
  history: SbnwAdvisorRound[];
  iAmFirstStart: boolean;
  myNickname: string;
  result: SbnwAdvisorResult;
  winType: SBNWWinType | null;
}): SbnwAdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  const actions: SbnwAdvisorKifu['actions'] = [];
  let myScore = 0;
  let oppScore = 0;
  let myTiles = sbnwEmptyPool();
  let oppTiles = sbnwEmptyPool();
  let rematchIndex = 0;

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    if (rec.rematchIndex > rematchIndex) {
      rematchIndex = rec.rematchIndex;
      myScore = 0;
      oppScore = 0;
      myTiles = sbnwEmptyPool();
      oppTiles = sbnwEmptyPool();
    }
    const myBefore = myScore;
    const oppBefore = oppScore;
    const myCountBefore = sbnwPoolTotal(myTiles);
    const oppCountBefore = sbnwPoolTotal(oppTiles);
    const myV = sbnwTilesToValue(rec.myTiles);
    const oppV = sbnwTilesToValue(rec.oppTiles);
    myTiles = sbnwConsume(myTiles, rec.myTiles);
    oppTiles = sbnwConsume(oppTiles, rec.oppTiles);
    let winnerId: string | null = null;
    if (myV > oppV) {
      myScore += 1;
      winnerId = SBNW_ADVISOR_ME;
    } else if (oppV > myV) {
      oppScore += 1;
      winnerId = SBNW_ADVISOR_OPP;
    }
    actions.push({
      round: i + 1,
      rematchIndex: rec.rematchIndex,
      firstPlayerId: rec.iWasFirst ? SBNW_ADVISOR_ME : SBNW_ADVISOR_OPP,
      players: {
        me: {
          nickname: myNick,
          tilesUsed: rec.myTiles,
          digits: rec.myTiles.length,
          valueStr: myV.toString(),
          scoreChange: myScore - myBefore,
          scoreBefore: myBefore,
          scoreAfter: myScore,
          tileCountBefore: myCountBefore,
          tileCountAfter: sbnwPoolTotal(myTiles),
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          tilesUsed: rec.oppTiles,
          digits: rec.oppTiles.length,
          valueStr: oppV.toString(),
          scoreChange: oppScore - oppBefore,
          scoreBefore: oppBefore,
          scoreAfter: oppScore,
          tileCountBefore: oppCountBefore,
          tileCountAfter: sbnwPoolTotal(oppTiles),
        },
      },
      winnerId,
    });
  }

  const reason = opts.result.kind !== 'playing' ? opts.result.reason : null;
  return {
    advisor: true,
    iAmFirstStart: opts.iAmFirstStart,
    winType: opts.winType,
    finishReason: reason,
    finalScores: { me: myScore, opp: oppScore },
    finalTiles: { me: myTiles, opp: oppTiles },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}
