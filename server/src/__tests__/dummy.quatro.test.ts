import { describe, it, expect } from 'vitest';
import {
  candidates,
  distinctSize,
  isQuatro,
  pickOpenCard,
  pickQuatroActionAsync,
  shouldMulligan,
  shouldStopEarly,
  vpPickFrom,
  type QuatroDummyView,
} from '../dummy/ai/quatro.js';
import { quatroMulliganThinkSeconds } from '../dummy/thinkTime.js';
import type { QuatroCard } from '@shared/types/quatro.js';

function c(id: string, suit: QuatroCard['suit'], num: number): QuatroCard {
  return { id, suit, num };
}

function emptyVps(): QuatroDummyView['vps'] {
  return [0, 1, 2, 3, 4, 5].map((i) => ({
    index: i,
    receivedOpen: [],
    hiddenCount: 3,
    usedByMe: false,
    usedByOpp: false,
  }));
}

function view(over: Partial<QuatroDummyView> = {}): QuatroDummyView {
  const hand = over.my?.hand ?? [
    c('spade-6', 'spade', 6),
    c('heart-6', 'heart', 6),
    c('club-2', 'club', 2),
    c('diamond-3', 'diamond', 3),
  ];
  return {
    gameOver: false,
    phase: 'mulligan',
    round: 0,
    firstId: 'dummy',
    currentTurnId: 'dummy',
    myId: 'dummy',
    oppId: 'human',
    my: {
      hand,
      openIds: [],
      mulligansUsed: 0,
      stopped: false,
      vpUsedCount: 0,
      usedVps: [],
      ...over.my,
    },
    opp: {
      openCards: [],
      closedCount: 4,
      mulligansUsed: 0,
      stopped: false,
      vpUsedCount: 0,
      ...over.opp,
    },
    vps: emptyVps(),
    iOpened: false,
    oppOpened: false,
    mustExchangeRemaining: 0,
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
    my: {
      hand,
      openIds: [],
      mulligansUsed: 0,
      stopped: false,
      vpUsedCount: 0,
      usedVps: [],
      ...over.my,
    },
    opp: {
      openCards: [],
      closedCount: 4,
      mulligansUsed: 0,
      stopped: false,
      vpUsedCount: 0,
      ...over.opp,
    },
  };
}

describe('콰트로 더미 기보 축', () => {
  it('공개 뷰에 VP 전체 패·상대 미오픈 필드가 없다', () => {
    const v = view();
    expect(v.vps.every((vp) => !('cards' in vp))).toBe(true);
    expect('hand' in v.opp).toBe(false);
  });

  it('멀리건·오픈 사고는 5~10초 정수', () => {
    for (let i = 0; i < 40; i++) {
      const t = quatroMulliganThinkSeconds();
      expect(t).toBeGreaterThanOrEqual(5);
      expect(t).toBeLessThanOrEqual(10);
      expect(Number.isInteger(t)).toBe(true);
    }
  });

  it('콰트로면 멀리건하지 않고, 검정0 2장이면 한다', () => {
    const q: QuatroCard[] = [
      c('spade-6', 'spade', 6),
      c('heart-5', 'heart', 5),
      c('diamond-4', 'diamond', 4),
      c('club-3', 'club', 3),
    ];
    expect(isQuatro(q)).toBe(true);
    expect(shouldMulligan(q, 0)).toBe(false);
    const twoBlack: QuatroCard[] = [
      c('black-0-a', 'black', 0),
      c('black-0-b', 'black', 0),
      c('spade-6', 'spade', 6),
      c('heart-5', 'heart', 5),
    ];
    expect(isQuatro(twoBlack)).toBe(false);
    expect(shouldMulligan(twoBlack, 0)).toBe(true);
  });

  it('R1 오픈은 높은 키퍼(6)를 잠근다. 이미 6을 열었으면 중복 6이 아니라 다른 숫자', () => {
    const v1 = view({
      phase: 'open',
      round: 1,
      my: {
        hand: [
          c('spade-6', 'spade', 6),
          c('heart-6', 'heart', 6),
          c('club-2', 'club', 2),
          c('diamond-5', 'diamond', 5),
        ],
        openIds: [],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    expect(pickOpenCard(v1)?.num).toBe(6);

    const v2 = view({
      phase: 'open',
      round: 2,
      my: {
        hand: v1.my.hand,
        openIds: ['spade-6'],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    expect(pickOpenCard(v2)?.id).toBe('diamond-5');
    const openIds = candidates(v1)
      .filter((x) => x.action.type === 'open')
      .map((x) => x.action.type === 'open' ? x.action.cardId : '');
    expect(openIds).toContain('club-2');
    expect(openIds).toContain('spade-6');
  });

  it('초반 교환은 스탑이 기본, 마지막 페이즈는 스탑 불가', () => {
    const early = view({ phase: 'exchange', round: 1 });
    expect(shouldStopEarly(early)).toBe(true);
    expect(candidates(early).some((c) => c.action.type === 'stop')).toBe(true);

    const last = view({
      phase: 'exchange',
      round: 3,
      my: {
        hand: [
          c('spade-6', 'spade', 6),
          c('heart-5', 'heart', 5),
          c('club-2', 'club', 2),
          c('diamond-3', 'diamond', 3),
        ],
        openIds: ['spade-6', 'heart-5', 'diamond-3'],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    expect(shouldStopEarly(last)).toBe(false);
    expect(candidates(last).every((c) => c.action.type !== 'stop')).toBe(true);
    expect(candidates(last).some((c) => c.action.type === 'exchange')).toBe(true);
  });

  it('VP 픽은 숨은 검정0을 우선 (규칙 복사, 실상태 금지)', () => {
    const recv = vpPickFrom(
      [c('club-6', 'club', 6), c('black-0-a', 'black', 0), c('spade-1', 'spade', 1)],
      [c('heart-4', 'heart', 4)],
    );
    expect(recv.suit).toBe('black');
  });

  it('검정0 한 장은 콰트로 만능', () => {
    expect(isQuatro([
      c('spade-6', 'spade', 6),
      c('heart-5', 'heart', 5),
      c('diamond-4', 'diamond', 4),
      c('black-0-a', 'black', 0),
    ])).toBe(true);
    expect(distinctSize([
      c('spade-6', 'spade', 6),
      c('heart-6', 'heart', 6),
      c('club-2', 'club', 2),
      c('diamond-3', 'diamond', 3),
    ])).toBe(3);
  });
});

describe('콰트로 더미 pick', () => {
  it.each(['하', '중', '상'] as const)('%s 콰트로 손은 멀리건 거부', async (tier) => {
    const hand: QuatroCard[] = [
      c('spade-6', 'spade', 6),
      c('heart-5', 'heart', 5),
      c('diamond-4', 'diamond', 4),
      c('club-3', 'club', 3),
    ];
    const action = await pickQuatroActionAsync(view({ my: {
      hand, openIds: [], mulligansUsed: 0, stopped: false, vpUsedCount: 0, usedVps: [],
    } }), 'dummy', tier, 80);
    expect(action).toEqual({ type: 'mulligan', use: false });
  });

  it('상 검정0 2장+중복 낮은 손은 멀리건', async () => {
    const action = await pickQuatroActionAsync(view({ my: {
      hand: [
        c('black-0-a', 'black', 0),
        c('black-0-b', 'black', 0),
        c('spade-1', 'spade', 1),
        c('heart-1', 'heart', 1),
      ],
      openIds: [],
      mulligansUsed: 0,
      stopped: false,
      vpUsedCount: 0,
      usedVps: [],
    } }), 'dummy', '상', 80);
    expect(action).toEqual({ type: 'mulligan', use: true });
  });

  it.each(['하', '중', '상'] as const)('%s R1 오픈은 6(키퍼)', async (tier) => {
    const v = view({
      phase: 'open',
      round: 1,
      my: {
        hand: [
          c('spade-6', 'spade', 6),
          c('heart-6', 'heart', 6),
          c('club-2', 'club', 2),
          c('diamond-5', 'diamond', 5),
        ],
        openIds: [],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    const action = await pickQuatroActionAsync(v, 'dummy', tier, 80);
    expect(action?.type).toBe('open');
    if (action?.type === 'open') {
      expect(action.cardId.endsWith('-6')).toBe(true);
    }
  });

  it.each(['하', '중', '상'] as const)('%s R1 교환은 스탑', async (tier) => {
    const v = view({
      phase: 'exchange',
      round: 1,
      my: {
        hand: [
          c('spade-6', 'spade', 6),
          c('heart-5', 'heart', 5),
          c('diamond-4', 'diamond', 4),
          c('club-3', 'club', 3),
        ],
        openIds: ['spade-6'],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    const action = await pickQuatroActionAsync(v, 'dummy', tier, 80);
    expect(action).toEqual({ type: 'stop' });
  });

  it.each(['하', '중', '상'] as const)('%s 마지막 교환은 스탑이 아니다', async (tier) => {
    const v = view({
      phase: 'exchange',
      round: 3,
      my: {
        hand: [
          c('spade-6', 'spade', 6),
          c('heart-5', 'heart', 5),
          c('club-2', 'club', 2),
          c('diamond-3', 'diamond', 3),
        ],
        openIds: ['spade-6', 'heart-5', 'diamond-3'],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    const action = await pickQuatroActionAsync(v, 'dummy', tier, 80);
    expect(action?.type).toBe('exchange');
    if (action?.type === 'exchange') {
      expect(action.giveCardId).toBe('club-2');
    }
  });

  it('VP 샘플이 비어도 pick이 무한 루프하지 않는다', async () => {
    const v = view({
      phase: 'exchange',
      round: 3,
      vps: [0, 1, 2, 3, 4, 5].map((i) => ({
        index: i,
        receivedOpen: [],
        hiddenCount: 20,
        usedByMe: false,
        usedByOpp: false,
      })),
      my: {
        hand: [
          c('spade-6', 'spade', 6),
          c('heart-5', 'heart', 5),
          c('club-2', 'club', 2),
          c('diamond-3', 'diamond', 3),
        ],
        openIds: ['spade-6', 'heart-5', 'diamond-3'],
        mulligansUsed: 0,
        stopped: false,
        vpUsedCount: 0,
        usedVps: [],
      },
    });
    const started = Date.now();
    const action = await pickQuatroActionAsync(v, 'dummy', '상', 0);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(action?.type).toBe('exchange');
  });
});
