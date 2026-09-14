import {
  SMS2_INITIAL_CHIPS,
  SMS2_INITIAL_POWDER,
  SMS2_MAX_ROUNDS,
  powderStageOf,
  sms2ApplyChipDelta,
  sms2IsPowderStage,
  sumBet,
  sumPowder,
  zeroPowder,
  type SMS2ChipBet,
  type SMS2MarkId,
  type SMS2PowderStage,
  type SMS2PowderSubmission,
  type SMS2WinType,
} from './sun-moon-star-2';

export interface Sms2AdvisorRound {
  myPowder: SMS2PowderSubmission;
  myBet: SMS2ChipBet;
  oppBet: SMS2ChipBet;
  litMark: SMS2MarkId;
  leftoverAfter: SMS2PowderSubmission;
  oppStageAfter: SMS2PowderStage;
}

export type Sms2AdvisorPending = {
  myPowder?: SMS2PowderSubmission;
  oppStageAfter?: SMS2PowderStage;
  myBet?: SMS2ChipBet;
  oppFirstBet?: SMS2ChipBet;
};

export type Sms2AdvisorAsk =
  | 'powder'
  | 'need-opp-stage'
  | 'betFirst'
  | 'need-opp-first-bet'
  | 'betSecond'
  | 'need-result'
  | 'over';

export type Sms2AdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface Sms2AdvisorSide {
  chips: number;
  powderRemain: number;
  powderStage: SMS2PowderStage;
  contrib: SMS2PowderSubmission;
}

export interface Sms2AdvisorOpp {
  chips: number;
  powderStage: SMS2PowderStage;
}

export interface Sms2AdvisorSnapshot {
  round: number;
  maxRound: number;
  iAmFirst: boolean;
  leftover: SMS2PowderSubmission;
  my: Sms2AdvisorSide;
  opp: Sms2AdvisorOpp;
  result: Sms2AdvisorResult;
  winType: SMS2WinType;
}

export type Sms2AdvisorWinner = 'me' | 'opp' | 'draw';

function clonePowder(p: SMS2PowderSubmission): SMS2PowderSubmission {
  return { sun: p.sun, moon: p.moon, star: p.star };
}

function isMark(v: unknown): v is SMS2MarkId {
  return v === 'sun' || v === 'moon' || v === 'star';
}

export function sms2IsIntG(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
}

export function sms2IsIntLeftover(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 400;
}

export function sms2IsIntChip(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 64;
}

export function sms2ParsePowder(v: unknown): SMS2PowderSubmission | null {
  if (!v || typeof v !== 'object') return null;
  const rec = v as Record<string, unknown>;
  if (!sms2IsIntG(rec.sun) || !sms2IsIntG(rec.moon) || !sms2IsIntG(rec.star)) return null;
  return { sun: rec.sun, moon: rec.moon, star: rec.star };
}

export function sms2ParseLeftover(v: unknown): SMS2PowderSubmission | null {
  if (!v || typeof v !== 'object') return null;
  const rec = v as Record<string, unknown>;
  if (!sms2IsIntLeftover(rec.sun) || !sms2IsIntLeftover(rec.moon) || !sms2IsIntLeftover(rec.star)) {
    return null;
  }
  return { sun: rec.sun, moon: rec.moon, star: rec.star };
}

export function sms2ParseBet(v: unknown): SMS2ChipBet | null {
  if (!v || typeof v !== 'object') return null;
  const rec = v as Record<string, unknown>;
  if (!sms2IsIntChip(rec.sun) || !sms2IsIntChip(rec.moon) || !sms2IsIntChip(rec.star)) return null;
  return { sun: rec.sun, moon: rec.moon, star: rec.star };
}

function finishChips(
  my: number,
  opp: number,
  lastRound: boolean,
): { result: Sms2AdvisorResult; winType: SMS2WinType } | null {
  if (my <= 0 && opp <= 0) {
    return { result: { kind: 'draw', reason: '동시 0칩' }, winType: 'draw' };
  }
  if (my <= 0) {
    return { result: { kind: 'loss', reason: '0칩' }, winType: 'elimination' };
  }
  if (opp <= 0) {
    return { result: { kind: 'win', reason: '상대 0칩' }, winType: 'elimination' };
  }
  if (!lastRound) return null;
  if (my > opp) {
    return { result: { kind: 'win', reason: `칩 ${my} vs ${opp}` }, winType: 'chips' };
  }
  if (my < opp) {
    return { result: { kind: 'loss', reason: `칩 ${my} vs ${opp}` }, winType: 'chips' };
  }
  return { result: { kind: 'draw', reason: `칩 ${my} 동점` }, winType: 'draw' };
}

export function sms2AdvisorSnapshot(
  iAmFirstStart: boolean,
  history: Sms2AdvisorRound[],
): Sms2AdvisorSnapshot {
  let leftover = zeroPowder();
  let myChips = SMS2_INITIAL_CHIPS;
  let oppChips = SMS2_INITIAL_CHIPS;
  let myPowder = SMS2_INITIAL_POWDER;
  let myContrib = zeroPowder();
  let oppStage: SMS2PowderStage = 5;
  let iAmFirst = iAmFirstStart;

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    const round = i + 1;
    myPowder = Math.max(0, myPowder - sumPowder(rec.myPowder));
    myChips = sms2ApplyChipDelta(myChips, rec.myBet, rec.litMark);
    oppChips = sms2ApplyChipDelta(oppChips, rec.oppBet, rec.litMark);
    leftover = clonePowder(rec.leftoverAfter);
    oppStage = rec.oppStageAfter;
    myContrib = {
      sun: myContrib.sun + rec.myPowder.sun,
      moon: myContrib.moon + rec.myPowder.moon,
      star: myContrib.star + rec.myPowder.star,
    };
    myContrib[rec.litMark] = 0;

    const done = finishChips(myChips, oppChips, round >= SMS2_MAX_ROUNDS);
    if (done) {
      return {
        round: round + 1,
        maxRound: SMS2_MAX_ROUNDS,
        iAmFirst: !iAmFirst,
        leftover,
        my: {
          chips: myChips,
          powderRemain: myPowder,
          powderStage: powderStageOf(myPowder),
          contrib: myContrib,
        },
        opp: { chips: oppChips, powderStage: oppStage },
        result: done.result,
        winType: done.winType,
      };
    }
    iAmFirst = !iAmFirst;
  }

  return {
    round: history.length + 1,
    maxRound: SMS2_MAX_ROUNDS,
    iAmFirst,
    leftover: clonePowder(leftover),
    my: {
      chips: myChips,
      powderRemain: myPowder,
      powderStage: powderStageOf(myPowder),
      contrib: clonePowder(myContrib),
    },
    opp: { chips: oppChips, powderStage: oppStage },
    result: { kind: 'playing' },
    winType: null,
  };
}

export function sms2AdvisorAsk(
  iAmFirstStart: boolean,
  history: Sms2AdvisorRound[],
  pending?: Sms2AdvisorPending | null,
): Sms2AdvisorAsk {
  const snap = sms2AdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') return 'over';
  const p = pending ?? {};
  if (!p.myPowder) return 'powder';
  if (p.oppStageAfter == null) return 'need-opp-stage';
  if (snap.iAmFirst) {
    if (!p.myBet) return 'betFirst';
    return 'need-result';
  }
  if (!p.oppFirstBet) return 'need-opp-first-bet';
  if (!p.myBet) return 'betSecond';
  return 'need-result';
}

export function sms2AdvisorFinished(result: Sms2AdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function sms2AdvisorWinnerFromResult(result: Sms2AdvisorResult): Sms2AdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export const SMS2_ADVISOR_ME = 'me';
export const SMS2_ADVISOR_OPP = 'opp';

function powderOk(p: SMS2PowderSubmission, remain: number): boolean {
  return p.sun >= 0 && p.moon >= 0 && p.star >= 0 && sumPowder(p) <= remain;
}

function betOk(b: SMS2ChipBet, chips: number): boolean {
  return b.sun >= 0 && b.moon >= 0 && b.star >= 0 && sumBet(b) <= chips;
}

export function sms2AdvisorRoundLegal(
  before: Sms2AdvisorSnapshot,
  rec: Sms2AdvisorRound,
): boolean {
  if (before.result.kind !== 'playing') return false;
  if (!powderOk(rec.myPowder, before.my.powderRemain)) return false;
  if (!betOk(rec.myBet, before.my.chips)) return false;
  if (!betOk(rec.oppBet, before.opp.chips)) return false;
  if (rec.leftoverAfter[rec.litMark] !== 0) return false;
  if (before.iAmFirst) {
    const max = Math.min(before.my.chips, Math.max(0, Math.floor(before.opp.chips / 2)));
    if (sumBet(rec.myBet) > max) return false;
    const min = sumBet(rec.myBet) <= 0 ? 0 : sumBet(rec.myBet) * 2;
    if (sumBet(rec.oppBet) < min) return false;
  } else {
    const max = Math.min(before.opp.chips, Math.max(0, Math.floor(before.my.chips / 2)));
    if (sumBet(rec.oppBet) > max) return false;
    const min = sumBet(rec.oppBet) <= 0 ? 0 : sumBet(rec.oppBet) * 2;
    if (sumBet(rec.myBet) < min) return false;
  }
  return true;
}

export function sms2ParseAdvisorRound(raw: unknown): Sms2AdvisorRound | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if ('oppPowder' in rec || 'oppPowderRemain' in rec || 'pendingPowder' in rec) return null;
  const myPowder = sms2ParsePowder(rec.myPowder);
  const myBet = sms2ParseBet(rec.myBet);
  const oppBet = sms2ParseBet(rec.oppBet);
  const leftoverAfter = sms2ParseLeftover(rec.leftoverAfter);
  if (!myPowder || !myBet || !oppBet || !leftoverAfter) return null;
  if (!isMark(rec.litMark) || !sms2IsPowderStage(rec.oppStageAfter)) return null;
  return {
    myPowder,
    myBet,
    oppBet,
    litMark: rec.litMark,
    leftoverAfter,
    oppStageAfter: rec.oppStageAfter,
  };
}

export interface Sms2AdvisorKifu {
  advisor: true;
  iAmFirstStart: boolean;
  winType: SMS2WinType;
  finalChips: Record<string, number>;
  actions: Array<{
    round: number;
    matchDescription: string;
    players: Record<string, {
      nickname: string;
      powder: SMS2PowderSubmission;
      bet: SMS2ChipBet;
      chipsAfter: number;
      byAi?: boolean;
    }>;
    litMark: SMS2MarkId;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildSms2AdvisorKifu(opts: {
  history: Sms2AdvisorRound[];
  iAmFirstStart: boolean;
  myNickname: string;
  result: Sms2AdvisorResult;
  winType: SMS2WinType;
}): Sms2AdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  const actions: Sms2AdvisorKifu['actions'] = [];
  let myChips = SMS2_INITIAL_CHIPS;
  let oppChips = SMS2_INITIAL_CHIPS;

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    myChips = sms2ApplyChipDelta(myChips, rec.myBet, rec.litMark);
    oppChips = sms2ApplyChipDelta(oppChips, rec.oppBet, rec.litMark);
    const labels: Record<SMS2MarkId, string> = { sun: '해', moon: '달', star: '별' };
    actions.push({
      round: i + 1,
      matchDescription: `점등 ${labels[rec.litMark]}`,
      litMark: rec.litMark,
      players: {
        me: {
          nickname: myNick,
          powder: rec.myPowder,
          bet: rec.myBet,
          chipsAfter: myChips,
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          powder: zeroPowder(),
          bet: rec.oppBet,
          chipsAfter: oppChips,
        },
      },
    });
  }

  return {
    advisor: true,
    iAmFirstStart: opts.iAmFirstStart,
    winType: opts.winType,
    finalChips: { me: myChips, opp: oppChips },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}
