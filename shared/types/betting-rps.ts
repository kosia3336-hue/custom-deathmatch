export const BRPS_TOTAL_ROUNDS = 10;
export const BRPS_REVEAL_DELAY_MS = 5000;
export const BRPS_WIN_DISPLAY_MS = 2000;
export const BRPS_INITIAL_CHIPS = 2;
export const BRPS_BET_MULTIPLIER = 3;

/** 승부 플레이어가 '승'을 선택했을 때 획득하는 칩 수 (라운드 기반 스케일링) */
export function brpsMatchWinBonus(round: number): number {
  return Math.ceil(round / 3);
}

export type BRPSPhase = 'roleSelect' | 'submit' | 'reveal' | 'finished';
export type BRPSResult = 'win' | 'draw' | 'lose';
export type BRPSRole = 'match' | 'bet' | null;
export type BRPSBetOutcome = 'success' | 'fail' | 'refund';
export type BRPSWinType = 'chips' | 'draw' | 'timeout' | 'leave';

export interface BRPSPlayerInfo {
  id: string;
  nickname: string;
  chips: number;
  role: BRPSRole;
  hasChoiceRight: boolean;
  submitted: boolean;
  /** submit 페이즈: 본인(match 역할)에게만 공개, 나머지 null */
  matchResult: BRPSResult | null;
  /** submit 페이즈: 본인(bet 역할)에게만 공개, 나머지 null */
  prediction: BRPSResult | null;
  /** submit 페이즈: 본인(bet 역할)에게만 공개, 나머지 null */
  betChips: number | null;
}

export interface BRPSRevealPlayerData {
  role: BRPSRole;
  matchResult: BRPSResult | null;
  prediction: BRPSResult | null;
  betChips: number | null;
  betOutcome: BRPSBetOutcome | null;
  chipsBefore: number;
  chipsAfter: number;
  chipChange: number;
}

export interface BRPSRevealData {
  players: Record<string, BRPSRevealPlayerData>;
}

export interface BRPSRoundRecord {
  round: number;
  choiceRightPlayerId: string;
  players: Record<
    string,
    {
      role: BRPSRole;
      matchResult: BRPSResult | null;
      prediction: BRPSResult | null;
      betChips: number | null;
      betOutcome: BRPSBetOutcome | null;
      chipsBefore: number;
      chipsAfter: number;
      chipChange: number;
    }
  >;
}

export interface BettingRpsGameData {
  phase: BRPSPhase;
  round: number;
  totalRounds: number;
  players: Record<string, BRPSPlayerInfo>;
  revealData: BRPSRevealData | null;
  revealEndsAt?: number;
  finishedEndsAt?: number;
  roundHistory: BRPSRoundRecord[];
  winner: string | null;
  winType: BRPSWinType | null;
}

export type BettingRpsAction =
  | { type: 'selectRole'; role: 'match' | 'bet' }
  | { type: 'submitMatch'; result: BRPSResult }
  | { type: 'submitBet'; prediction: BRPSResult; chips: number };

export const BRPS_RESULTS: readonly BRPSResult[] = ['win', 'draw', 'lose'];

export function brpsJudgeBet(matchResult: BRPSResult, prediction: BRPSResult): BRPSBetOutcome {
  if (matchResult === 'draw' && prediction !== 'draw') return 'refund';
  if (prediction === matchResult) return 'success';
  return 'fail';
}

export function brpsSettleChips(
  currentChips: number,
  betChips: number,
  outcome: BRPSBetOutcome,
  multiplier: number = 2,
): number {
  switch (outcome) {
    case 'success':
      return currentChips + betChips * (multiplier - 1);
    case 'fail':
      return Math.max(0, currentChips - betChips);
    case 'refund':
      return currentChips;
  }
}

export function brpsBetMultiplier(prediction: BRPSResult): number {
  return prediction === 'draw' ? BRPS_BET_MULTIPLIER : 2;
}

/** 1라운드 선택권 = 선공. 홀수 라운드가 선공 선택권. */
export function brpsHasChoiceRight(iAmFirst: boolean, round: number): boolean {
  const odd = round % 2 === 1;
  return iAmFirst ? odd : !odd;
}

export interface BrpsAdvisorRound {
  myRole: 'match' | 'bet';
  matchResult: BRPSResult;
  prediction: BRPSResult;
  betChips: number;
}

export interface BrpsAdvisorPending {
  myRole?: 'match' | 'bet';
  oppRole?: 'match' | 'bet';
}

export type BrpsAdvisorAsk = 'role' | 'match' | 'bet' | 'need-opp-role' | 'finished';

export type BrpsAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface BrpsAdvisorSnapshot {
  round: number;
  myChips: number;
  oppChips: number;
  iAmFirst: boolean;
  myChoiceRight: boolean;
  result: BrpsAdvisorResult;
}

export interface BrpsRoundChips {
  myChips: number;
  oppChips: number;
  outcome: BRPSBetOutcome;
}

export function brpsApplyRound(
  round: number,
  myRole: 'match' | 'bet',
  matchResult: BRPSResult,
  prediction: BRPSResult,
  betChips: number,
  myChips: number,
  oppChips: number,
): BrpsRoundChips {
  const bonus = brpsMatchWinBonus(round);
  const outcome = brpsJudgeBet(matchResult, prediction);
  const mult = brpsBetMultiplier(prediction);
  if (myRole === 'match') {
    return {
      myChips: myChips + (matchResult === 'win' ? bonus : 0),
      oppChips: brpsSettleChips(oppChips, betChips, outcome, mult),
      outcome,
    };
  }
  return {
    myChips: brpsSettleChips(myChips, betChips, outcome, mult),
    oppChips: oppChips + (matchResult === 'win' ? bonus : 0),
    outcome,
  };
}

export function brpsAdvisorSnapshot(
  iAmFirst: boolean,
  history: BrpsAdvisorRound[],
): BrpsAdvisorSnapshot {
  let myChips = BRPS_INITIAL_CHIPS;
  let oppChips = BRPS_INITIAL_CHIPS;
  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    const next = brpsApplyRound(
      i + 1,
      rec.myRole,
      rec.matchResult,
      rec.prediction,
      rec.betChips,
      myChips,
      oppChips,
    );
    myChips = next.myChips;
    oppChips = next.oppChips;
  }
  const played = history.length;
  if (played >= BRPS_TOTAL_ROUNDS) {
    const round = BRPS_TOTAL_ROUNDS + 1;
    if (myChips > oppChips) {
      return {
        round,
        myChips,
        oppChips,
        iAmFirst,
        myChoiceRight: false,
        result: { kind: 'win', reason: `칩 ${myChips} vs ${oppChips}` },
      };
    }
    if (myChips < oppChips) {
      return {
        round,
        myChips,
        oppChips,
        iAmFirst,
        myChoiceRight: false,
        result: { kind: 'loss', reason: `칩 ${myChips} vs ${oppChips}` },
      };
    }
    return {
      round,
      myChips,
      oppChips,
      iAmFirst,
      myChoiceRight: false,
      result: { kind: 'draw', reason: `칩 ${myChips} vs ${oppChips} 동점` },
    };
  }
  const round = played + 1;
  return {
    round,
    myChips,
    oppChips,
    iAmFirst,
    myChoiceRight: brpsHasChoiceRight(iAmFirst, round),
    result: { kind: 'playing' },
  };
}

export function brpsAdvisorAsk(
  iAmFirst: boolean,
  history: BrpsAdvisorRound[],
  pending?: BrpsAdvisorPending | null,
): BrpsAdvisorAsk {
  const snap = brpsAdvisorSnapshot(iAmFirst, history);
  if (snap.result.kind !== 'playing') return 'finished';
  if (snap.myChoiceRight) {
    const role = pending?.myRole;
    if (role !== 'match' && role !== 'bet') return 'role';
    return role;
  }
  const oppRole = pending?.oppRole;
  if (oppRole !== 'match' && oppRole !== 'bet') return 'need-opp-role';
  return oppRole === 'match' ? 'bet' : 'match';
}

export const BRPS_ADVISOR_ME = 'me';
export const BRPS_ADVISOR_OPP = 'opp';
export type BrpsAdvisorWinner = 'me' | 'opp' | 'draw';

export function brpsAdvisorFinished(result: BrpsAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function brpsAdvisorWinnerFromResult(result: BrpsAdvisorResult): BrpsAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export interface BrpsAdvisorKifuRoundPlayer {
  nickname: string;
  role: BRPSRole;
  matchResult: BRPSResult | null;
  prediction: BRPSResult | null;
  betChips: number | null;
  betOutcome: BRPSBetOutcome | null;
  chipsBefore: number;
  chipsAfter: number;
  chipChange: number;
  byAi?: boolean;
}

export interface BrpsAdvisorKifu {
  advisor: true;
  winType: BRPSWinType;
  finalChips: Record<string, number>;
  totalRounds: number;
  actions: Array<{
    round: number;
    choiceRightPlayerId: string;
    players: Record<string, BrpsAdvisorKifuRoundPlayer>;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildBrpsAdvisorKifu(opts: {
  history: BrpsAdvisorRound[];
  iAmFirst: boolean;
  myNickname: string;
  result: BrpsAdvisorResult;
}): BrpsAdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  let myChips = BRPS_INITIAL_CHIPS;
  let oppChips = BRPS_INITIAL_CHIPS;
  const actions: BrpsAdvisorKifu['actions'] = [];

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    const round = i + 1;
    const myBefore = myChips;
    const oppBefore = oppChips;
    const settled = brpsApplyRound(
      round,
      rec.myRole,
      rec.matchResult,
      rec.prediction,
      rec.betChips,
      myChips,
      oppChips,
    );
    myChips = settled.myChips;
    oppChips = settled.oppChips;
    const myIsMatch = rec.myRole === 'match';
    const myOutcome = myIsMatch ? null : settled.outcome;
    const oppOutcome = myIsMatch ? settled.outcome : null;
    actions.push({
      round,
      choiceRightPlayerId: brpsHasChoiceRight(opts.iAmFirst, round)
        ? BRPS_ADVISOR_ME
        : BRPS_ADVISOR_OPP,
      players: {
        [BRPS_ADVISOR_ME]: {
          nickname: myNick,
          role: rec.myRole,
          matchResult: myIsMatch ? rec.matchResult : null,
          prediction: myIsMatch ? null : rec.prediction,
          betChips: myIsMatch ? null : rec.betChips,
          betOutcome: myOutcome,
          chipsBefore: myBefore,
          chipsAfter: myChips,
          chipChange: myChips - myBefore,
          byAi: true,
        },
        [BRPS_ADVISOR_OPP]: {
          nickname: oppNick,
          role: myIsMatch ? 'bet' : 'match',
          matchResult: myIsMatch ? null : rec.matchResult,
          prediction: myIsMatch ? rec.prediction : null,
          betChips: myIsMatch ? rec.betChips : null,
          betOutcome: oppOutcome,
          chipsBefore: oppBefore,
          chipsAfter: oppChips,
          chipChange: oppChips - oppBefore,
        },
      },
    });
  }

  const winType: BRPSWinType = opts.result.kind === 'draw' ? 'draw' : 'chips';
  return {
    advisor: true,
    winType,
    finalChips: { [BRPS_ADVISOR_ME]: myChips, [BRPS_ADVISOR_OPP]: oppChips },
    totalRounds: BRPS_TOTAL_ROUNDS,
    actions,
    players: {
      [BRPS_ADVISOR_ME]: { nickname: myNick },
      [BRPS_ADVISOR_OPP]: { nickname: oppNick },
    },
  };
}
