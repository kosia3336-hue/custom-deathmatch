import { describe, it, expect } from 'vitest';
import {
  beliefFromHistory,
  estimateCheapness,
  evaluateSecondBids,
  firstBidAtoms,
  inferSpendRange,
  legalSecondBids,
  pickBnw2ActionAsync,
  pWinGame,
  type Bnw2DummyRoundRecord,
  type Bnw2DummyView,
} from '../dummy/ai/bnw2.js';

function view(over: Partial<Bnw2DummyView> & Pick<Bnw2DummyView, 'phase'>): Bnw2DummyView {
  return {
    gameOver: false,
    round: 1,
    myId: 'dummy',
    oppId: 'human',
    firstPlayerId: 'human',
    my: { score: 0, remainingPoints: 200, stage: 10, submitted: false },
    opp: { score: 0, stage: 10, submitted: true },
    prevFirstStage: 10,
    firstPlayerColor: 'black',
    roundHistory: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
  };
}

function bestSecond(v: Bnw2DummyView, cheapness = 0.66, mix = 0.04): number {
  const scored = evaluateSecondBids(v, cheapness, mix);
  let best = scored[0]!;
  for (const s of scored) {
    if (s.ev > best.ev + 1e-12 || (Math.abs(s.ev - best.ev) <= 1e-12 && s.bid < best.bid)) {
      best = s;
    }
  }
  return best.bid;
}

describe('흑과백2 더미 공개 구간', () => {
  it('단계 유지 + 흑이면 제시 0~9', () => {
    expect(inferSpendRange(10, 10, 'black')).toEqual({ lo: 0, hi: 9 });
  });

  it('단계 유지 + 백이면 10~19 (200 기준 같은 단계)', () => {
    expect(inferSpendRange(10, 10, 'white')).toEqual({ lo: 10, hi: 19 });
  });

  it('1단계 하락 + 백이면 상한+1은 2칸(40+)', () => {
    const r = inferSpendRange(10, 9, 'white');
    expect(r.hi + 1).toBeGreaterThanOrEqual(40);
  });
});

describe('흑과백2 게임 승률', () => {
  it('잔여 0인데 상대가 연료 있으면 점수가 앞서도 0', () => {
    expect(pWinGame(4, 2, 0, 80, false)).toBe(0);
  });

  it('10점이면 1', () => {
    expect(pWinGame(10, 4, 0, 80, true)).toBe(1);
  });
});

describe('흑과백2 사후분포 (난수 하나 아님)', () => {
  it('1칸 백이면 제시 질량이 20~39에 퍼지고, 싼 성향이면 20 쪽이 39보다 큼', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'white',
      prevFirstStage: 10,
      opp: { score: 0, stage: 9, submitted: true },
    });
    const atoms = firstBidAtoms(v, 0.78, 0);
    const mass: number[] = Array.from({ length: 201 }, () => 0);
    for (const a of atoms) mass[a.bid] += a.p;
    const support = mass.map((p, bid) => ({ bid, p })).filter((x) => x.p > 1e-9);
    expect(support.every((x) => x.bid >= 20 && x.bid <= 39)).toBe(true);
    expect(support.length).toBeGreaterThan(10);
    expect(mass[20]!).toBeGreaterThan(mass[39]!);
  });

  it('빈 이력이면 잔여는 200에 모여 있다', () => {
    const b = beliefFromHistory([], 'human', 0.66, 0.04);
    expect(b[200]).toBeGreaterThan(0.99);
  });

  it('흑 유지 한 라운드면 잔여가 191~200으로 줄어든다', () => {
    const history: Bnw2DummyRoundRecord[] = [
      {
        round: 1,
        firstPlayerId: 'human',
        winnerId: 'dummy',
        players: {
          human: {
            color: 'black',
            scoreChange: 0,
            scoreBefore: 0,
            scoreAfter: 0,
            stageBefore: 10,
            stageAfter: 10,
          },
          dummy: {
            color: 'black',
            scoreChange: 1,
            scoreBefore: 0,
            scoreAfter: 1,
            stageBefore: 10,
            stageAfter: 10,
          },
        },
      },
    ];
    const b = beliefFromHistory(history, 'human', 0.7, 0);
    let lo = 200;
    let hi = 0;
    for (let i = 0; i <= 200; i++) {
      if (b[i]! > 1e-9) {
        lo = Math.min(lo, i);
        hi = Math.max(hi, i);
      }
    }
    expect(lo).toBeGreaterThanOrEqual(191);
    expect(hi).toBeLessThanOrEqual(200);
    expect(b[200]!).toBeGreaterThan(0);
  });
});

describe('흑과백2 후플은 게임 승률 (차이수 고정 아님)', () => {
  it('불 2칸이면 접는다', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'white',
      prevFirstStage: 10,
      opp: { score: 0, stage: 8, submitted: true },
    });
    expect(bestSecond(v)).toBe(0);
  });

  it('흑 유지는 싸게 막는다 (1~10, 40으로 확정승 아님)', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'black',
      prevFirstStage: 10,
      opp: { score: 0, stage: 10, submitted: true },
    });
    const bid = bestSecond(v);
    expect(bid).toBeGreaterThanOrEqual(1);
    expect(bid).toBeLessThanOrEqual(10);
  });

  it('1칸 백 초반은 2칸(40+)으로 사지 않는다', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'white',
      prevFirstStage: 10,
      opp: { score: 0, stage: 9, submitted: true },
    });
    const bid = bestSecond(v);
    expect(bid).toBeLessThan(40);
    expect(bid === 0 || (bid >= 10 && bid <= 28)).toBe(true);
  });

  it('1칸이어도 매치포인트면 빈손 금지', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'white',
      prevFirstStage: 10,
      my: { score: 9, remainingPoints: 80, stage: 4, submitted: false },
      opp: { score: 9, stage: 9, submitted: true },
    });
    expect(bestSecond(v)).toBeGreaterThan(0);
  });

  it('점수 뒤지면 1칸 백을 접지 않는다', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'white',
      prevFirstStage: 10,
      my: { score: 0, remainingPoints: 200, stage: 10, submitted: false },
      opp: { score: 4, stage: 9, submitted: true },
    });
    const bid = bestSecond(v);
    expect(bid).toBeGreaterThan(0);
    expect(bid).toBeLessThan(40);
  });

  it('상대가 9점이면 흑 유지도 접지 않는다', () => {
    const v = view({
      phase: 'secondSubmit',
      firstPlayerColor: 'black',
      prevFirstStage: 10,
      my: { score: 8, remainingPoints: 80, stage: 4, submitted: false },
      opp: { score: 9, stage: 10, submitted: true },
    });
    expect(bestSecond(v)).toBeGreaterThan(0);
  });
});

describe('흑과백2 더미 pick', () => {
  it('잔여 0이면 0', async () => {
    const action = await pickBnw2ActionAsync(
      view({
        phase: 'secondSubmit',
        my: { score: 0, remainingPoints: 0, stage: 0, submitted: false },
      }),
      'dummy',
      '중',
      0,
    );
    expect(action).toEqual({ type: 'submitSecond', points: 0 });
  });

  it('합법: 0 이상 잔여 이하, firstPoints 필드 없음', async () => {
    const v = view({ phase: 'secondSubmit', firstPlayerColor: 'black', prevFirstStage: 10 });
    expect('firstPoints' in v).toBe(false);
    const action = await pickBnw2ActionAsync(v, 'dummy', '상', 0);
    expect(action?.type).toBe('submitSecond');
    if (action?.type === 'submitSecond') {
      expect(action.points).toBeGreaterThanOrEqual(0);
      expect(action.points).toBeLessThanOrEqual(200);
      expect(Number.isInteger(action.points)).toBe(true);
    }
  });

  it('게임포인트 후플은 빈손을 피한다', async () => {
    const action = await pickBnw2ActionAsync(
      view({
        phase: 'secondSubmit',
        firstPlayerColor: 'black',
        prevFirstStage: 10,
        my: { score: 8, remainingPoints: 80, stage: 4, submitted: false },
        opp: { score: 9, stage: 10, submitted: true },
      }),
      'dummy',
      '상',
      5,
    );
    expect(action?.type).toBe('submitSecond');
    if (action?.type === 'submitSecond') {
      expect(action.points).toBeGreaterThan(0);
    }
  });

  it('선이 불 1칸이면 후는 2칸(40+)으로 확정승하지 않고, 구간 난수+1처럼 흩어지지 않는다', async () => {
    const bids: number[] = [];
    for (let i = 0; i < 12; i++) {
      const action = await pickBnw2ActionAsync(
        view({
          phase: 'secondSubmit',
          firstPlayerColor: 'white',
          prevFirstStage: 10,
          my: { score: 0, remainingPoints: 200, stage: 10, submitted: false },
          opp: { score: 0, stage: 9, submitted: true },
        }),
        'dummy',
        '상',
        0,
      );
      expect(action?.type).toBe('submitSecond');
      if (action?.type === 'submitSecond') bids.push(action.points);
    }
    expect(bids.every((b) => b < 40)).toBe(true);
    const unique = new Set(bids).size;
    expect(unique).toBeLessThanOrEqual(4);
    const mean = bids.reduce((a, b) => a + b, 0) / bids.length;
    expect(mean).not.toBeGreaterThan(32);
  });

  it('선이 불 2칸이면 후는 0', async () => {
    const zeros: number[] = [];
    for (let i = 0; i < 8; i++) {
      const action = await pickBnw2ActionAsync(
        view({
          phase: 'secondSubmit',
          firstPlayerColor: 'white',
          prevFirstStage: 10,
          my: { score: 0, remainingPoints: 200, stage: 10, submitted: false },
          opp: { score: 0, stage: 8, submitted: true },
        }),
        'dummy',
        '상',
        0,
      );
      if (action?.type === 'submitSecond') zeros.push(action.points);
    }
    expect(zeros.filter((b) => b === 0).length).toBe(zeros.length);
  });

  it('선이 불 안 끄고 흑이면 1~10으로 막는다', async () => {
    const bids: number[] = [];
    for (let i = 0; i < 8; i++) {
      const action = await pickBnw2ActionAsync(
        view({
          phase: 'secondSubmit',
          firstPlayerColor: 'black',
          prevFirstStage: 10,
          my: { score: 0, remainingPoints: 200, stage: 10, submitted: false },
          opp: { score: 0, stage: 10, submitted: true },
        }),
        'dummy',
        '상',
        0,
      );
      if (action?.type === 'submitSecond') bids.push(action.points);
    }
    expect(bids.every((b) => b >= 1 && b <= 10)).toBe(true);
  });

  it('선플 초반은 합법 정수', async () => {
    const action = await pickBnw2ActionAsync(
      view({
        phase: 'firstSubmit',
        firstPlayerId: 'dummy',
        my: { score: 0, remainingPoints: 200, stage: 10, submitted: false },
        opp: { score: 0, stage: 10, submitted: false },
        prevFirstStage: null,
        firstPlayerColor: null,
      }),
      'dummy',
      '상',
      0,
    );
    expect(action?.type).toBe('submitFirst');
    if (action?.type === 'submitFirst') {
      expect(action.points).toBeGreaterThanOrEqual(0);
      expect(action.points).toBeLessThanOrEqual(48);
    }
  });
});

describe('흑과백2 후플 지배되는 수 (상중하 공통)', () => {
  it('선이 백이면 1~9는 후보가 아니다', () => {
    const stay = legalSecondBids(200, 'white', { lo: 10, hi: 19 });
    const drop1 = legalSecondBids(200, 'white', { lo: 20, hi: 39 });
    expect(stay).toContain(0);
    expect(stay).toContain(10);
    expect(stay).not.toContain(5);
    expect(drop1).toContain(0);
    expect(drop1).toContain(20);
    expect(drop1).not.toContain(5);
    expect(drop1).not.toContain(15);
  });

  it('잔여가 백을 못 이기면 0만', () => {
    expect(legalSecondBids(5, 'white', { lo: 10, hi: 19 })).toEqual([0]);
  });

  it.each(['하', '중', '상'] as const)('선이 백이면 %s도 1~9를 내지 않는다', async (tier) => {
    const spots = [
      { firstPlayerColor: 'white' as const, prevFirstStage: 10, oppStage: 10 },
      { firstPlayerColor: 'white' as const, prevFirstStage: 10, oppStage: 9 },
    ];
    for (const spot of spots) {
      const bids: number[] = [];
      for (let i = 0; i < 8; i++) {
        const action = await pickBnw2ActionAsync(
          view({
            phase: 'secondSubmit',
            firstPlayerColor: spot.firstPlayerColor,
            prevFirstStage: spot.prevFirstStage,
            opp: { score: 0, stage: spot.oppStage, submitted: true },
          }),
          'dummy',
          tier,
          0,
        );
        if (action?.type === 'submitSecond') bids.push(action.points);
      }
      expect(bids.length).toBe(8);
      expect(bids.every((b) => b === 0 || b >= 10)).toBe(true);
    }
  });
});

describe('흑과백2 성향', () => {
  it('선으로 불 2칸을 내면 싼 성향이 떨어진다', () => {
    const history: Bnw2DummyRoundRecord[] = [
      {
        round: 1,
        firstPlayerId: 'human',
        winnerId: 'human',
        players: {
          human: {
            color: 'white',
            scoreChange: 1,
            scoreBefore: 0,
            scoreAfter: 1,
            stageBefore: 10,
            stageAfter: 8,
          },
        },
      },
    ];
    expect(estimateCheapness(history, 'human')).toBeLessThan(0.66);
  });
});
