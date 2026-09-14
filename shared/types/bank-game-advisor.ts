import {
  BANK_DENOMINATIONS,
  BANK_INITIAL_TOTAL_AMOUNT,
  BANK_INITIAL_TOTAL_COUNT,
  BANK_TOTAL_ROUNDS,
  bankAmountRangeForCount,
  bankMaxValueWithNotes,
  cloneBet,
  initialInventory,
  subtractInventory,
  sumBetAmount,
  sumBetCount,
  sumInventoryAmount,
  sumInventoryCount,
  validateBet,
  zeroBet,
  type BankBet,
  type BankWinType,
} from './bank-game';

export type BankAdvisorOutcome = 'win' | 'loss' | 'draw';

export interface BankAdvisorRound {
  myBet: BankBet;
  oppCount: number;
  outcome: BankAdvisorOutcome;
  /** 내가 지거나 숨은 승자면 null. 승·무는 공개 금액. */
  oppAmount: number | null;
}

export type BankAdvisorPending = {
  firstCount?: number;
  myBet?: BankBet;
};

export type BankAdvisorAsk =
  | 'betFirst'
  | 'need-first-count'
  | 'betSecond'
  | 'need-result'
  | 'over';

export type BankAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface BankAdvisorSide {
  score: number;
  inventory: BankBet;
  inventoryCount: number;
  inventoryAmount: number;
}

export interface BankAdvisorOpp {
  score: number;
  inventoryCount: number;
}

export interface BankAdvisorSnapshot {
  round: number;
  maxRound: number;
  iAmFirst: boolean;
  my: BankAdvisorSide;
  opp: BankAdvisorOpp;
  knownOppSpent: number;
  hiddenOppNotes: number;
  result: BankAdvisorResult;
  winType: BankWinType;
}

export type BankAdvisorWinner = 'me' | 'opp' | 'draw';

const FORBIDDEN = [
  'oppInventory',
  'oppBet',
  'pendingBet',
  'inventoryAmount',
  'firstAmount',
  'secondAmount',
] as const;

export function bankIsIntNote(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 40;
}

export function bankIsIntAmount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= BANK_INITIAL_TOTAL_AMOUNT && v % 1000 === 0;
}

export function bankParseBet(v: unknown): BankBet | null {
  if (!v || typeof v !== 'object') return null;
  const rec = v as Record<string, unknown>;
  const out = zeroBet();
  for (const d of BANK_DENOMINATIONS) {
    const n = rec[d] ?? rec[String(d)];
    if (!bankIsIntNote(n)) return null;
    out[d] = n;
  }
  return out;
}

function finishScores(
  my: number,
  opp: number,
  lastRound: boolean,
): { result: BankAdvisorResult; winType: BankWinType } | null {
  if (!lastRound) return null;
  if (my > opp) return { result: { kind: 'win', reason: `${my} vs ${opp}` }, winType: 'score' };
  if (my < opp) return { result: { kind: 'loss', reason: `${my} vs ${opp}` }, winType: 'score' };
  return { result: { kind: 'draw', reason: `${my}점 동점` }, winType: 'draw' };
}

export function bankAdvisorSnapshot(
  iAmFirstStart: boolean,
  history: BankAdvisorRound[],
): BankAdvisorSnapshot {
  let myInv = initialInventory();
  let myScore = 0;
  let oppScore = 0;
  let oppCount = BANK_INITIAL_TOTAL_COUNT;
  let knownOppSpent = 0;
  let hiddenOppNotes = 0;
  let iAmFirst = iAmFirstStart;

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    myInv = subtractInventory(myInv, rec.myBet);
    oppCount = Math.max(0, oppCount - rec.oppCount);
    if (rec.outcome === 'win') myScore += 1;
    else if (rec.outcome === 'loss') oppScore += 1;
    if (rec.oppAmount != null) knownOppSpent += rec.oppAmount;
    else hiddenOppNotes += rec.oppCount;

    const done = finishScores(myScore, oppScore, i + 1 >= BANK_TOTAL_ROUNDS);
    if (done) {
      return {
        round: i + 2,
        maxRound: BANK_TOTAL_ROUNDS,
        iAmFirst: !iAmFirst,
        my: {
          score: myScore,
          inventory: cloneBet(myInv),
          inventoryCount: sumInventoryCount(myInv),
          inventoryAmount: sumInventoryAmount(myInv),
        },
        opp: { score: oppScore, inventoryCount: oppCount },
        knownOppSpent,
        hiddenOppNotes,
        result: done.result,
        winType: done.winType,
      };
    }
    iAmFirst = !iAmFirst;
  }

  return {
    round: history.length + 1,
    maxRound: BANK_TOTAL_ROUNDS,
    iAmFirst,
    my: {
      score: myScore,
      inventory: cloneBet(myInv),
      inventoryCount: sumInventoryCount(myInv),
      inventoryAmount: sumInventoryAmount(myInv),
    },
    opp: { score: oppScore, inventoryCount: oppCount },
    knownOppSpent,
    hiddenOppNotes,
    result: { kind: 'playing' },
    winType: null,
  };
}

export function bankAdvisorAsk(
  iAmFirstStart: boolean,
  history: BankAdvisorRound[],
  pending?: BankAdvisorPending | null,
): BankAdvisorAsk {
  const snap = bankAdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') return 'over';
  const p = pending ?? {};
  if (snap.iAmFirst) {
    if (!p.myBet) return 'betFirst';
    return 'need-result';
  }
  if (p.firstCount == null) return 'need-first-count';
  if (!p.myBet) return 'betSecond';
  return 'need-result';
}

export function bankAdvisorFinished(result: BankAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function bankAdvisorWinnerFromResult(result: BankAdvisorResult): BankAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export const BANK_ADVISOR_ME = 'me';
export const BANK_ADVISOR_OPP = 'opp';

export function bankOppRemainBounds(snap: BankAdvisorSnapshot): { min: number; max: number } {
  const n = snap.opp.inventoryCount;
  const spentLo = snap.knownOppSpent + snap.hiddenOppNotes * 1000;
  const spentHi = snap.knownOppSpent + bankMaxValueWithNotes(snap.hiddenOppNotes);
  const remainHi = Math.min(bankMaxValueWithNotes(n), BANK_INITIAL_TOTAL_AMOUNT - spentLo);
  const remainLo = Math.max(n * 1000, BANK_INITIAL_TOTAL_AMOUNT - spentHi);
  const min = Math.max(0, Math.min(remainLo, remainHi));
  const max = Math.max(min, Math.max(remainLo, remainHi));
  return { min, max };
}

export function bankAdvisorRoundLegal(
  before: BankAdvisorSnapshot,
  rec: BankAdvisorRound,
): boolean {
  if (before.result.kind !== 'playing') return false;
  if (!validateBet(rec.myBet, before.my.inventory).ok) return false;
  if (!bankIsIntNote(rec.oppCount) || rec.oppCount > before.opp.inventoryCount) return false;
  if (rec.outcome !== 'win' && rec.outcome !== 'loss' && rec.outcome !== 'draw') return false;
  if (rec.outcome === 'loss') {
    if (rec.oppAmount != null) return false;
    return true;
  }
  if (rec.oppAmount == null || !bankIsIntAmount(rec.oppAmount)) return false;
  const range = bankAmountRangeForCount(rec.oppCount);
  if (rec.oppAmount < range.min || rec.oppAmount > range.max) return false;
  if (rec.outcome === 'draw' && rec.oppAmount !== sumBetAmount(rec.myBet)) return false;
  return true;
}

export function bankParseAdvisorRound(raw: unknown): BankAdvisorRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  for (const key of FORBIDDEN) {
    if (key in rec) return null;
  }
  const myBet = bankParseBet(rec.myBet);
  if (!myBet) return null;
  if (!bankIsIntNote(rec.oppCount)) return null;
  const outcome = rec.outcome;
  if (outcome !== 'win' && outcome !== 'loss' && outcome !== 'draw') return null;
  if (outcome === 'loss') {
    if (rec.oppAmount != null) return null;
    return { myBet, oppCount: rec.oppCount, outcome, oppAmount: null };
  }
  if (!bankIsIntAmount(rec.oppAmount)) return null;
  return { myBet, oppCount: rec.oppCount, outcome, oppAmount: rec.oppAmount };
}

export interface BankAdvisorKifu {
  advisor: true;
  iAmFirstStart: boolean;
  winType: BankWinType;
  finalScores: Record<string, number>;
  actions: Array<{
    round: number;
    matchDescription: string;
    players: Record<string, {
      nickname: string;
      bet: BankBet;
      count: number;
      amount: number | null;
      scoreAfter: number;
      byAi?: boolean;
    }>;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildBankAdvisorKifu(opts: {
  history: BankAdvisorRound[];
  iAmFirstStart: boolean;
  myNickname: string;
  result: BankAdvisorResult;
  winType: BankWinType;
}): BankAdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  const actions: BankAdvisorKifu['actions'] = [];
  let myScore = 0;
  let oppScore = 0;

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    if (rec.outcome === 'win') myScore += 1;
    else if (rec.outcome === 'loss') oppScore += 1;
    const label =
      rec.outcome === 'win' ? '나 승' : rec.outcome === 'loss' ? '상대 승' : '무';
    actions.push({
      round: i + 1,
      matchDescription: label,
      players: {
        me: {
          nickname: myNick,
          bet: cloneBet(rec.myBet),
          count: sumBetCount(rec.myBet),
          amount: sumBetAmount(rec.myBet),
          scoreAfter: myScore,
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          bet: zeroBet(),
          count: rec.oppCount,
          amount: rec.oppAmount,
          scoreAfter: oppScore,
        },
      },
    });
  }

  return {
    advisor: true,
    iAmFirstStart: opts.iAmFirstStart,
    winType: opts.winType,
    finalScores: { me: myScore, opp: oppScore },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}
