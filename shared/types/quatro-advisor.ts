import type { QuatroAction, QuatroCard, QuatroPhase } from './quatro';
import {
  QUATRO_HAND_SIZE,
  QUATRO_MAX_MULLIGANS,
  QUATRO_VP_COUNT,
  cloneQuatroCard,
  quatroCardById,
  quatroFullDeck,
  quatroJudgeHands,
} from './quatro';

export type QuatroAdvisorBy = 'me' | 'opp';

export type QuatroAdvisorPly =
  | { kind: 'deal'; myHand: QuatroCard[] }
  | { kind: 'mulligan'; by: QuatroAdvisorBy; use: false }
  | { kind: 'mulligan'; by: 'me'; use: true; newHand: QuatroCard[] }
  | { kind: 'mulligan'; by: 'opp'; use: true }
  | { kind: 'open'; by: QuatroAdvisorBy; card: QuatroCard }
  | { kind: 'stop'; by: QuatroAdvisorBy }
  | { kind: 'exchange'; by: 'me'; vpIndex: number; gave: QuatroCard; received: QuatroCard }
  | { kind: 'exchange'; by: 'opp'; vpIndex: number; gave: QuatroCard };

export type QuatroAdvisorAsk =
  | 'deal'
  | 'mulligan'
  | 'need-opp-mulligan'
  | 'open'
  | 'need-opp-open'
  | 'exchange'
  | 'need-opp-exchange'
  | 'over';

export type QuatroAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export type QuatroAdvisorWinner = 'me' | 'opp' | 'draw';

export interface QuatroAdvisorVp {
  index: number;
  receivedOpen: QuatroCard[];
  hiddenCount: number;
  usedByMe: boolean;
  usedByOpp: boolean;
}

export interface QuatroAdvisorSnapshot {
  phase: 'deal' | QuatroPhase;
  round: number;
  iAmFirst: boolean;
  myTurn: boolean;
  my: {
    hand: QuatroCard[];
    openIds: string[];
    mulligansUsed: number;
    mulliganDone: boolean;
    stopped: boolean;
    usedVps: number[];
    seenIds: string[];
  };
  opp: {
    openCards: QuatroCard[];
    closedCount: number;
    mulligansUsed: number;
    mulliganDone: boolean;
    stopped: boolean;
    vpUsedCount: number;
  };
  vps: QuatroAdvisorVp[];
  iOpened: boolean;
  oppOpened: boolean;
  mustExchangeRemaining: number;
  result: QuatroAdvisorResult;
}

export const QUATRO_ADVISOR_ME = 'me';
export const QUATRO_ADVISOR_OPP = 'opp';

const FORBIDDEN = [
  'oppHand',
  'cards',
  'vpCards',
  'oppClosed',
  'hand',
] as const;

interface Machine {
  phase: QuatroAdvisorSnapshot['phase'];
  round: number;
  iAmFirst: boolean;
  myHand: QuatroCard[];
  myOpenIds: Set<string>;
  myMulligansUsed: number;
  myMulliganDone: boolean;
  myStopped: boolean;
  myUsedVps: Set<number>;
  mySeen: Set<string>;
  oppOpen: QuatroCard[];
  oppMulligansUsed: number;
  oppMulliganDone: boolean;
  oppStopped: boolean;
  oppUsedVps: Set<number>;
  vps: QuatroAdvisorVp[];
  mulliganQueue: QuatroAdvisorBy[];
  turnQueue: QuatroAdvisorBy[];
  turnPtr: number;
  firstStopper: QuatroAdvisorBy | null;
  iOpened: boolean;
  oppOpened: boolean;
  result: QuatroAdvisorResult;
}

function emptyVps(): QuatroAdvisorVp[] {
  return Array.from({ length: QUATRO_VP_COUNT }, (_, index) => ({
    index,
    receivedOpen: [],
    hiddenCount: 3,
    usedByMe: false,
    usedByOpp: false,
  }));
}

function cloneCards(cards: QuatroCard[]): QuatroCard[] {
  return cards.map(cloneQuatroCard);
}

function idsOf(cards: QuatroCard[]): Set<string> {
  return new Set(cards.map((c) => c.id));
}

function uniqueValidHand(cards: QuatroCard[]): QuatroCard[] | null {
  if (cards.length !== QUATRO_HAND_SIZE) return null;
  const seen = new Set<string>();
  const out: QuatroCard[] = [];
  for (const c of cards) {
    const canon = quatroCardById(c.id);
    if (!canon || canon.suit !== c.suit || canon.num !== c.num) return null;
    if (seen.has(canon.id)) return null;
    seen.add(canon.id);
    out.push(cloneQuatroCard(canon));
  }
  return out;
}

function freshMachine(iAmFirstStart: boolean): Machine {
  return {
    phase: 'deal',
    round: 0,
    iAmFirst: iAmFirstStart,
    myHand: [],
    myOpenIds: new Set(),
    myMulligansUsed: 0,
    myMulliganDone: false,
    myStopped: false,
    myUsedVps: new Set(),
    mySeen: new Set(),
    oppOpen: [],
    oppMulligansUsed: 0,
    oppMulliganDone: false,
    oppStopped: false,
    oppUsedVps: new Set(),
    vps: [],
    mulliganQueue: [],
    turnQueue: [],
    turnPtr: 0,
    firstStopper: null,
    iOpened: false,
    oppOpened: false,
    result: { kind: 'playing' },
  };
}

export function quatroKnownIds(snap: Pick<QuatroAdvisorSnapshot, 'my' | 'opp' | 'vps'>): Set<string> {
  const ids = new Set<string>();
  for (const c of snap.my.hand) ids.add(c.id);
  for (const c of snap.opp.openCards) ids.add(c.id);
  for (const vp of snap.vps) {
    for (const c of vp.receivedOpen) ids.add(c.id);
  }
  return ids;
}

function machineKnown(m: Machine): Set<string> {
  const ids = new Set<string>(m.myHand.map((c) => c.id));
  for (const c of m.oppOpen) ids.add(c.id);
  for (const vp of m.vps) {
    for (const c of vp.receivedOpen) ids.add(c.id);
  }
  return ids;
}

function skipMulliganDone(m: Machine): void {
  while (m.mulliganQueue.length > 0) {
    const who = m.mulliganQueue[0]!;
    const done = who === 'me'
      ? m.myMulliganDone || m.myMulligansUsed >= QUATRO_MAX_MULLIGANS
      : m.oppMulliganDone || m.oppMulligansUsed >= QUATRO_MAX_MULLIGANS;
    if (!done) return;
    m.mulliganQueue.shift();
  }
}

function currentMulligan(m: Machine): QuatroAdvisorBy | null {
  skipMulliganDone(m);
  return m.mulliganQueue[0] ?? null;
}

function skipExchangeDone(m: Machine): void {
  while (m.turnPtr < m.turnQueue.length) {
    const who = m.turnQueue[m.turnPtr]!;
    const stopped = who === 'me' ? m.myStopped : m.oppStopped;
    const used = who === 'me' ? m.myUsedVps.size : m.oppUsedVps.size;
    if (stopped) {
      m.turnPtr += 1;
      continue;
    }
    if (used >= QUATRO_VP_COUNT) {
      if (who === 'me') m.myStopped = true;
      else m.oppStopped = true;
      m.turnPtr += 1;
      continue;
    }
    return;
  }
}

function currentExchange(m: Machine): QuatroAdvisorBy | null {
  skipExchangeDone(m);
  if (m.turnPtr >= m.turnQueue.length) return null;
  return m.turnQueue[m.turnPtr] ?? null;
}

function beginOpen(m: Machine): void {
  m.phase = 'open';
  m.iOpened = false;
  m.oppOpened = false;
  m.myStopped = false;
  m.oppStopped = false;
}

function startRounds(m: Machine): void {
  m.vps = emptyVps();
  m.round = 1;
  beginOpen(m);
}

function beginExchange(m: Machine): void {
  m.phase = 'exchange';
  m.myStopped = false;
  m.oppStopped = false;
  m.firstStopper = null;
  const f: QuatroAdvisorBy = m.iAmFirst ? 'me' : 'opp';
  const g: QuatroAdvisorBy = m.iAmFirst ? 'opp' : 'me';
  const seq: QuatroAdvisorBy[] = [f];
  let cur: QuatroAdvisorBy = g;
  while (seq.length < 24) {
    seq.push(cur, cur);
    cur = cur === f ? g : f;
  }
  m.turnQueue = seq;
  m.turnPtr = 0;
}

function finishWithOpens(m: Machine): void {
  const judged = quatroJudgeHands(m.myHand, m.oppOpen);
  m.phase = 'finished';
  if (judged.winner === 'me') m.result = { kind: 'win', reason: judged.reason };
  else if (judged.winner === 'opp') m.result = { kind: 'loss', reason: judged.reason };
  else m.result = { kind: 'draw', reason: judged.reason };
}

function afterBothOpened(m: Machine): void {
  if (m.round >= 4) {
    finishWithOpens(m);
    return;
  }
  beginExchange(m);
}

function endExchange(m: Machine): void {
  if (m.firstStopper) m.iAmFirst = m.firstStopper !== 'me';
  m.round += 1;
  beginOpen(m);
}

function afterExchangePly(m: Machine): void {
  m.turnPtr += 1;
  if (currentExchange(m) == null) endExchange(m);
}

function myClosed(m: Machine): QuatroCard[] {
  return m.myHand.filter((c) => !m.myOpenIds.has(c.id));
}

function applyPly(m: Machine, ply: QuatroAdvisorPly): boolean {
  if (m.result.kind !== 'playing') return false;

  if (ply.kind === 'deal') {
    if (m.phase !== 'deal') return false;
    const hand = uniqueValidHand(ply.myHand);
    if (!hand) return false;
    m.myHand = hand;
    m.mySeen = idsOf(hand);
    m.phase = 'mulligan';
    const f: QuatroAdvisorBy = m.iAmFirst ? 'me' : 'opp';
    const g: QuatroAdvisorBy = m.iAmFirst ? 'opp' : 'me';
    m.mulliganQueue = [f, g, f, g];
    return true;
  }

  if (ply.kind === 'mulligan') {
    if (m.phase !== 'mulligan') return false;
    const who = currentMulligan(m);
    if (who !== ply.by) return false;
    if (ply.use) {
      if (ply.by === 'me') {
        if (!('newHand' in ply) || !ply.newHand) return false;
        const next = uniqueValidHand(ply.newHand);
        if (!next) return false;
        if (next.some((c) => m.mySeen.has(c.id))) return false;
        for (const c of next) m.mySeen.add(c.id);
        m.myHand = next;
        m.myMulligansUsed += 1;
      } else {
        if ('newHand' in ply && ply.newHand) return false;
        m.oppMulligansUsed += 1;
      }
    } else {
      if ('newHand' in ply && ply.newHand) return false;
      if (ply.by === 'me') m.myMulliganDone = true;
      else m.oppMulliganDone = true;
    }
    m.mulliganQueue.shift();
    skipMulliganDone(m);
    if (m.mulliganQueue.length === 0) startRounds(m);
    return true;
  }

  if (ply.kind === 'open') {
    if (m.phase !== 'open') return false;
    const known = machineKnown(m);
    if (ply.by === 'me') {
      if (m.iOpened) return false;
      const card = m.myHand.find((c) => c.id === ply.card.id);
      if (!card || m.myOpenIds.has(card.id)) return false;
      if (card.suit !== ply.card.suit || card.num !== ply.card.num) return false;
      m.myOpenIds.add(card.id);
      m.iOpened = true;
    } else {
      if (m.oppOpened) return false;
      const canon = quatroCardById(ply.card.id);
      if (!canon || canon.suit !== ply.card.suit || canon.num !== ply.card.num) return false;
      if (known.has(canon.id)) return false;
      m.oppOpen.push(cloneQuatroCard(canon));
      m.oppOpened = true;
    }
    if (m.iOpened && m.oppOpened) afterBothOpened(m);
    return true;
  }

  if (ply.kind === 'stop') {
    if (m.phase !== 'exchange') return false;
    const who = currentExchange(m);
    if (who !== ply.by) return false;
    const used = ply.by === 'me' ? m.myUsedVps.size : m.oppUsedVps.size;
    if (m.round >= 3 && used < QUATRO_VP_COUNT) return false;
    if (!m.firstStopper) m.firstStopper = ply.by;
    if (ply.by === 'me') m.myStopped = true;
    else m.oppStopped = true;
    afterExchangePly(m);
    return true;
  }

  if (ply.kind === 'exchange') {
    if (m.phase !== 'exchange') return false;
    const who = currentExchange(m);
    if (who !== ply.by) return false;
    if (!Number.isInteger(ply.vpIndex) || ply.vpIndex < 0 || ply.vpIndex >= QUATRO_VP_COUNT) return false;
    const vp = m.vps[ply.vpIndex];
    if (!vp) return false;
    const usedSet = ply.by === 'me' ? m.myUsedVps : m.oppUsedVps;
    if (usedSet.has(ply.vpIndex)) return false;
    const gaveCanon = quatroCardById(ply.gave.id);
    if (!gaveCanon || gaveCanon.suit !== ply.gave.suit || gaveCanon.num !== ply.gave.num) return false;
    if (vp.hiddenCount <= 0) return false;

    if (ply.by === 'me') {
      if (!('received' in ply) || !ply.received) return false;
      const give = myClosed(m).find((c) => c.id === gaveCanon.id);
      if (!give) return false;
      const recvCanon = quatroCardById(ply.received.id);
      if (!recvCanon || recvCanon.suit !== ply.received.suit || recvCanon.num !== ply.received.num) return false;
      const known = machineKnown(m);
      if (known.has(recvCanon.id)) return false;
      m.myHand = [...m.myHand.filter((c) => c.id !== give.id), cloneQuatroCard(recvCanon)];
      m.mySeen.add(recvCanon.id);
      vp.receivedOpen = [...vp.receivedOpen, cloneQuatroCard(give)];
      vp.hiddenCount -= 1;
      vp.usedByMe = true;
      m.myUsedVps.add(ply.vpIndex);
    } else {
      if ('received' in ply && (ply as { received?: QuatroCard }).received) return false;
      const known = machineKnown(m);
      if (known.has(gaveCanon.id)) return false;
      vp.receivedOpen = [...vp.receivedOpen, cloneQuatroCard(gaveCanon)];
      vp.hiddenCount -= 1;
      vp.usedByOpp = true;
      m.oppUsedVps.add(ply.vpIndex);
    }
    afterExchangePly(m);
    return true;
  }

  return false;
}

function snapshotFrom(m: Machine): QuatroAdvisorSnapshot {
  const myTurn =
    m.result.kind === 'playing'
    && (
      (m.phase === 'mulligan' && currentMulligan(m) === 'me')
      || (m.phase === 'open' && !m.iOpened)
      || (m.phase === 'exchange' && currentExchange(m) === 'me')
    );
  const must =
    m.phase === 'exchange' && m.round >= 3
      ? Math.max(0, QUATRO_VP_COUNT - m.myUsedVps.size)
      : 0;
  return {
    phase: m.phase,
    round: m.round,
    iAmFirst: m.iAmFirst,
    myTurn,
    my: {
      hand: cloneCards(m.myHand),
      openIds: [...m.myOpenIds],
      mulligansUsed: m.myMulligansUsed,
      mulliganDone: m.myMulliganDone,
      stopped: m.myStopped,
      usedVps: [...m.myUsedVps].sort((a, b) => a - b),
      seenIds: [...m.mySeen],
    },
    opp: {
      openCards: cloneCards(m.oppOpen),
      closedCount: Math.max(0, QUATRO_HAND_SIZE - m.oppOpen.length),
      mulligansUsed: m.oppMulligansUsed,
      mulliganDone: m.oppMulliganDone,
      stopped: m.oppStopped,
      vpUsedCount: m.oppUsedVps.size,
    },
    vps: m.vps.map((vp) => ({
      index: vp.index,
      receivedOpen: cloneCards(vp.receivedOpen),
      hiddenCount: vp.hiddenCount,
      usedByMe: vp.usedByMe,
      usedByOpp: vp.usedByOpp,
    })),
    iOpened: m.iOpened,
    oppOpened: m.oppOpened,
    mustExchangeRemaining: must,
    result: m.result,
  };
}

function replay(iAmFirstStart: boolean, history: QuatroAdvisorPly[]): Machine | null {
  const m = freshMachine(iAmFirstStart);
  for (const ply of history) {
    if (!applyPly(m, ply)) return null;
  }
  return m;
}

export function quatroAdvisorSnapshot(
  iAmFirstStart: boolean,
  history: QuatroAdvisorPly[],
): QuatroAdvisorSnapshot {
  const m = replay(iAmFirstStart, history);
  if (!m) {
    const failed = freshMachine(iAmFirstStart);
    failed.result = { kind: 'loss', reason: '기록 오류' };
    failed.phase = 'finished';
    return snapshotFrom(failed);
  }
  return snapshotFrom(m);
}

export function quatroAdvisorPlyLegal(
  iAmFirstStart: boolean,
  history: QuatroAdvisorPly[],
  ply: QuatroAdvisorPly,
): boolean {
  const m = replay(iAmFirstStart, history);
  if (!m) return false;
  return applyPly(m, ply);
}

export function quatroAdvisorAsk(
  iAmFirstStart: boolean,
  history: QuatroAdvisorPly[],
): QuatroAdvisorAsk {
  const snap = quatroAdvisorSnapshot(iAmFirstStart, history);
  if (snap.result.kind !== 'playing') return 'over';
  if (snap.phase === 'deal') return 'deal';
  if (snap.phase === 'mulligan') return snap.myTurn ? 'mulligan' : 'need-opp-mulligan';
  if (snap.phase === 'open') {
    if (!snap.iOpened) return 'open';
    return 'need-opp-open';
  }
  if (snap.phase === 'exchange') return snap.myTurn ? 'exchange' : 'need-opp-exchange';
  return 'over';
}

export function quatroAdvisorFinished(result: QuatroAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function quatroAdvisorWinnerFromResult(result: QuatroAdvisorResult): QuatroAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export function quatroParseCard(raw: unknown): QuatroCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string') return null;
  const canon = quatroCardById(rec.id);
  if (!canon) return null;
  if (typeof rec.suit === 'string' && rec.suit !== canon.suit) return null;
  if (typeof rec.num === 'number' && rec.num !== canon.num) return null;
  return cloneQuatroCard(canon);
}

function parseHand(raw: unknown): QuatroCard[] | null {
  if (!Array.isArray(raw)) return null;
  const cards: QuatroCard[] = [];
  for (const row of raw) {
    const c = quatroParseCard(row);
    if (!c) return null;
    cards.push(c);
  }
  return uniqueValidHand(cards);
}

function hasForbidden(rec: Record<string, unknown>): boolean {
  for (const key of FORBIDDEN) {
    if (key in rec) return true;
  }
  return false;
}

export function quatroParseAdvisorPly(raw: unknown): QuatroAdvisorPly | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (hasForbidden(rec)) return null;
  const kind = rec.kind;
  if (kind === 'deal') {
    const myHand = parseHand(rec.myHand);
    if (!myHand) return null;
    return { kind: 'deal', myHand };
  }
  if (kind === 'mulligan') {
    const by = rec.by;
    if (by !== 'me' && by !== 'opp') return null;
    if (rec.use === false) {
      if (rec.newHand != null) return null;
      return { kind: 'mulligan', by, use: false };
    }
    if (rec.use !== true) return null;
    if (by === 'opp') {
      if (rec.newHand != null) return null;
      return { kind: 'mulligan', by: 'opp', use: true };
    }
    const newHand = parseHand(rec.newHand);
    if (!newHand) return null;
    return { kind: 'mulligan', by: 'me', use: true, newHand };
  }
  if (kind === 'open') {
    const by = rec.by;
    if (by !== 'me' && by !== 'opp') return null;
    const card = quatroParseCard(rec.card);
    if (!card) return null;
    return { kind: 'open', by, card };
  }
  if (kind === 'stop') {
    const by = rec.by;
    if (by !== 'me' && by !== 'opp') return null;
    return { kind: 'stop', by };
  }
  if (kind === 'exchange') {
    const by = rec.by;
    if (by !== 'me' && by !== 'opp') return null;
    if (typeof rec.vpIndex !== 'number' || !Number.isInteger(rec.vpIndex)) return null;
    const gave = quatroParseCard(rec.gave);
    if (!gave) return null;
    if (by === 'opp') {
      if (rec.received != null) return null;
      return { kind: 'exchange', by: 'opp', vpIndex: rec.vpIndex, gave };
    }
    const received = quatroParseCard(rec.received);
    if (!received) return null;
    return { kind: 'exchange', by: 'me', vpIndex: rec.vpIndex, gave, received };
  }
  return null;
}

export function quatroRemainingCards(snap: QuatroAdvisorSnapshot): QuatroCard[] {
  const known = quatroKnownIds(snap);
  return quatroFullDeck().filter((c) => !known.has(c.id));
}

export interface QuatroAdvisorKifu {
  advisor: true;
  iAmFirstStart: boolean;
  winType: 'quatro' | 'sum' | 'high' | 'draw';
  finalHands: { me: QuatroCard[]; opp: QuatroCard[] };
  actions: Array<{
    ply: QuatroAdvisorPly;
    byAi?: boolean;
  }>;
  players: Record<string, { nickname: string }>;
}

function winTypeOf(result: QuatroAdvisorResult): QuatroAdvisorKifu['winType'] {
  if (result.kind === 'draw') return 'draw';
  if (result.kind === 'playing') return 'sum';
  if (result.reason.includes('콰트로') && !result.reason.includes('합계')) return 'quatro';
  if (result.reason.includes('높은 카드')) return 'high';
  return 'sum';
}

export function buildQuatroAdvisorKifu(opts: {
  history: QuatroAdvisorPly[];
  iAmFirstStart: boolean;
  myNickname: string;
  result: QuatroAdvisorResult;
}): QuatroAdvisorKifu {
  const snap = quatroAdvisorSnapshot(opts.iAmFirstStart, opts.history);
  return {
    advisor: true,
    iAmFirstStart: opts.iAmFirstStart,
    winType: winTypeOf(opts.result),
    finalHands: { me: cloneCards(snap.my.hand), opp: cloneCards(snap.opp.openCards) },
    actions: opts.history.map((ply) => ({
      ply,
      byAi: ply.kind !== 'deal' && (ply.kind === 'mulligan' || ply.kind === 'open' || ply.kind === 'stop' || ply.kind === 'exchange') && ply.by === 'me',
    })),
    players: {
      me: { nickname: opts.myNickname || '나' },
      opp: { nickname: '상대' },
    },
  };
}

export function quatroActionFromPly(ply: QuatroAdvisorPly): QuatroAction | null {
  if (ply.kind === 'mulligan') return { type: 'mulligan', use: ply.use };
  if (ply.kind === 'open' && ply.by === 'me') return { type: 'open', cardId: ply.card.id };
  if (ply.kind === 'stop' && ply.by === 'me') return { type: 'stop' };
  if (ply.kind === 'exchange' && ply.by === 'me') {
    return { type: 'exchange', vpIndex: ply.vpIndex, giveCardId: ply.gave.id };
  }
  return null;
}
