import {
  CARD_LABELS,
  GS2_EXTENDED_ROUNDS,
  GS2_INITIAL_SUGAR,
  GS2_TOTAL_ROUNDS,
  gs2DiceEffective,
  gs2IsDiceFace,
  makeInitialHand,
  type GS2CardId,
  type GS2DiceFace,
  type GS2WinType,
  type Gs2AdvisorAsk,
  type Gs2AdvisorResult,
  type Gs2AdvisorRound,
  type Gs2AdvisorSnapshot,
  type Gs2AdvisorWinner,
} from './grape-sugar-2';
import { resolveRound } from './grape-sugar-2-resolve';

function removeCard(hand: GS2CardId[], card: GS2CardId): GS2CardId[] | null {
  const i = hand.indexOf(card);
  if (i < 0) return null;
  return [...hand.slice(0, i), ...hand.slice(i + 1)];
}

function applyHrStart(
  mySugar: number,
  myHr: number,
  oppSugar: number,
  oppHr: number,
): { mySugar: number; oppSugar: number } {
  if (myHr > 0) {
    const t = Math.min(myHr, mySugar);
    mySugar -= t;
    oppSugar += t;
  }
  if (oppHr > 0) {
    const t = Math.min(oppHr, oppSugar);
    oppSugar -= t;
    mySugar += t;
  }
  return { mySugar, oppSugar };
}

function makeRoller(rec: Gs2AdvisorRound): () => GS2DiceFace {
  const queue: GS2DiceFace[] = [];
  if (gs2DiceEffective(rec.myCard, rec.oppCard, 'me')) {
    queue.push(gs2IsDiceFace(rec.myDice) ? rec.myDice : 4);
  }
  if (gs2DiceEffective(rec.myCard, rec.oppCard, 'opp')) {
    queue.push(gs2IsDiceFace(rec.oppDice) ? rec.oppDice : 4);
  }
  let i = 0;
  return () => queue[i++] ?? 4;
}

function finishByScore(
  myScore: number,
  oppScore: number,
): { result: Gs2AdvisorResult; winType: GS2WinType } {
  if (myScore > oppScore) {
    return {
      result: { kind: 'win', reason: `점수 ${myScore} vs ${oppScore}` },
      winType: 'score',
    };
  }
  if (myScore < oppScore) {
    return {
      result: { kind: 'loss', reason: `점수 ${myScore} vs ${oppScore}` },
      winType: 'score',
    };
  }
  return {
    result: { kind: 'draw', reason: `점수 ${myScore} 동점` },
    winType: 'draw',
  };
}

function playingSnap(
  round: number,
  maxRound: 8 | 9,
  breathAvailable: boolean,
  myScore: number,
  oppScore: number,
  mySugar: number,
  oppSugar: number,
  myHand: GS2CardId[],
  oppHand: GS2CardId[],
): Gs2AdvisorSnapshot {
  return {
    round,
    maxRound,
    breathAvailable,
    my: { score: myScore, sugarRemain: mySugar, hand: myHand },
    opp: { score: oppScore, sugarRemain: oppSugar, hand: oppHand },
    result: { kind: 'playing' },
    winType: null,
  };
}

export function gs2AdvisorSnapshot(history: Gs2AdvisorRound[]): Gs2AdvisorSnapshot {
  let myHand = makeInitialHand();
  let oppHand = makeInitialHand();
  let myScore = 0;
  let oppScore = 0;
  let mySugar = GS2_INITIAL_SUGAR;
  let oppSugar = GS2_INITIAL_SUGAR;
  let maxRound: 8 | 9 = GS2_TOTAL_ROUNDS;
  let breathAvailable = true;
  let myHr = 0;
  let oppHr = 0;

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    const started = applyHrStart(mySugar, myHr, oppSugar, oppHr);
    mySugar = started.mySugar;
    oppSugar = started.oppSugar;
    myHr = 0;
    oppHr = 0;

    const round = i + 1;
    const nextMy = removeCard(myHand, rec.myCard);
    const nextOpp = removeCard(oppHand, rec.oppCard);
    if (!nextMy || !nextOpp) {
      return {
        round,
        maxRound,
        breathAvailable,
        my: { score: myScore, sugarRemain: mySugar, hand: myHand },
        opp: { score: oppScore, sugarRemain: oppSugar, hand: oppHand },
        result: { kind: 'loss', reason: '수순이 올바르지 않습니다' },
        winType: 'abandon',
      };
    }

    mySugar = Math.max(0, mySugar - rec.mySugar);
    oppSugar = Math.max(0, oppSugar - rec.oppSugar);
    myHand = nextMy;
    oppHand = nextOpp;

    const result = resolveRound(
      { card: rec.myCard, sugar: rec.mySugar },
      { card: rec.oppCard, sugar: rec.oppSugar },
      {
        breathAvailable,
        isFinalRound: round >= maxRound,
        rollDice: makeRoller(rec),
      },
    );

    if (result.instantWin === 'p1') {
      return {
        round: round + 1,
        maxRound,
        breathAvailable,
        my: { score: myScore, sugarRemain: mySugar, hand: myHand },
        opp: { score: oppScore, sugarRemain: oppSugar, hand: oppHand },
        result: { kind: 'win', reason: '무행동 vs 우주뿌셔' },
        winType: 'instantWin',
      };
    }
    if (result.instantWin === 'p2') {
      return {
        round: round + 1,
        maxRound,
        breathAvailable,
        my: { score: myScore, sugarRemain: mySugar, hand: myHand },
        opp: { score: oppScore, sugarRemain: oppSugar, hand: oppHand },
        result: { kind: 'loss', reason: '무행동 vs 우주뿌셔' },
        winType: 'instantWin',
      };
    }

    myScore += result.scoreDelta.p1;
    oppScore += result.scoreDelta.p2;
    myHr = result.hrPenaltyScheduled.p1;
    oppHr = result.hrPenaltyScheduled.p2;
    if (result.breathExtended) {
      maxRound = GS2_EXTENDED_ROUNDS;
      breathAvailable = false;
    }

    if (round >= maxRound) {
      const done = finishByScore(myScore, oppScore);
      return {
        round: round + 1,
        maxRound,
        breathAvailable,
        my: { score: myScore, sugarRemain: mySugar, hand: myHand },
        opp: { score: oppScore, sugarRemain: oppSugar, hand: oppHand },
        result: done.result,
        winType: done.winType,
      };
    }
  }

  const started = applyHrStart(mySugar, myHr, oppSugar, oppHr);
  return playingSnap(
    history.length + 1,
    maxRound,
    breathAvailable,
    myScore,
    oppScore,
    started.mySugar,
    started.oppSugar,
    myHand,
    oppHand,
  );
}

export function gs2AdvisorFinished(result: Gs2AdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function gs2AdvisorWinnerFromResult(result: Gs2AdvisorResult): Gs2AdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

export function gs2AdvisorAsk(history: Gs2AdvisorRound[]): Gs2AdvisorAsk {
  const snap = gs2AdvisorSnapshot(history);
  return snap.result.kind === 'playing' ? 'submit' : 'over';
}

export const GS2_ADVISOR_ME = 'me';
export const GS2_ADVISOR_OPP = 'opp';

export interface Gs2AdvisorKifu {
  advisor: true;
  winType: GS2WinType;
  finalStats: Record<string, { score: number; sugarRemain: number }>;
  actions: Array<{
    round: number;
    matchDescription: string;
    players: Record<string, {
      nickname: string;
      card: GS2CardId;
      sugar: number;
      dice?: GS2DiceFace;
      scoreAfter: number;
      sugarRemainAfter: number;
      byAi?: boolean;
    }>;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildGs2AdvisorKifu(opts: {
  history: Gs2AdvisorRound[];
  myNickname: string;
  result: Gs2AdvisorResult;
  winType: GS2WinType;
}): Gs2AdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  const actions: Gs2AdvisorKifu['actions'] = [];

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    const after = gs2AdvisorSnapshot(opts.history.slice(0, i + 1));
    const desc = `${CARD_LABELS[rec.myCard]} ${rec.mySugar} vs ${CARD_LABELS[rec.oppCard]} ${rec.oppSugar}`;
    actions.push({
      round: i + 1,
      matchDescription: desc,
      players: {
        me: {
          nickname: myNick,
          card: rec.myCard,
          sugar: rec.mySugar,
          dice: rec.myDice,
          scoreAfter: after.my.score,
          sugarRemainAfter: after.my.sugarRemain,
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          card: rec.oppCard,
          sugar: rec.oppSugar,
          dice: rec.oppDice,
          scoreAfter: after.opp.score,
          sugarRemainAfter: after.opp.sugarRemain,
        },
      },
    });
  }

  const end = gs2AdvisorSnapshot(opts.history);
  return {
    advisor: true,
    winType: opts.winType,
    finalStats: {
      me: { score: end.my.score, sugarRemain: end.my.sugarRemain },
      opp: { score: end.opp.score, sugarRemain: end.opp.sugarRemain },
    },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}
