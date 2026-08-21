import { describe, it, expect } from 'vitest';
import {
  heightBand,
  inferredBand,
  isKnownGift,
  pickFiveTowersActionAsync,
  sureCompleteTowers,
  type FiveTowersDummyView,
} from '../dummy/ai/five-towers.js';
import type { FTTower, FTTowerPublicInfo } from '@shared/types/five-towers.js';

function pub(id: FTTower, over: Partial<FTTowerPublicInfo> = {}): FTTowerPublicInfo {
  return {
    id,
    completed: false,
    completedBy: null,
    milestonesReached: { half: false, complete: false },
    minKnownHeight: 0,
    ...over,
  };
}

function view(over: Partial<FiveTowersDummyView> = {}): FiveTowersDummyView {
  const towers = {
    A: pub('A'),
    B: pub('B'),
    C: pub('C'),
    D: pub('D'),
    E: pub('E'),
  };
  return {
    gameOver: false,
    phase: 'turn',
    turn: 8,
    currentPlayerId: 'dummy',
    myId: 'dummy',
    oppId: 'human',
    myScore: 0,
    oppScore: 0,
    myStacked: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    itemUsed: false,
    myItemUsedKind: null,
    towers,
    myInfoResults: [],
    mySecretLog: [],
    unresolvedSecrets: [],
    actionLog: [],
    milestoneLog: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
    towers: { ...towers, ...over.towers },
    myStacked: { A: 0, B: 0, C: 0, D: 0, E: 0, ...over.myStacked },
  };
}

describe('5개의 탑 더미 기보 축', () => {
  it('공개 밴드는 마일스톤만 (0–5 / 6–10 / 11). 진짜 높이 필드 없음', () => {
    const v = view();
    expect(heightBand(v.towers.A, 0)).toEqual({ lo: 0, hi: 5 });
    expect(heightBand(pub('A', { milestonesReached: { half: true, complete: false }, minKnownHeight: 6 }), 0)).toEqual({
      lo: 6,
      hi: 10,
    });
    expect('height' in v.towers.A).toBe(false);
  });

  it('상대 스택이 없으면 높이 = 내 기여 (7칸에 3칸은 선물)', () => {
    const v = view({
      myStacked: { A: 7, B: 0, C: 0, D: 0, E: 0 },
      towers: {
        A: pub('A', { milestonesReached: { half: true, complete: false }, minKnownHeight: 6 }),
        B: pub('B'),
        C: pub('C'),
        D: pub('D'),
        E: pub('E'),
      },
    });
    expect(inferredBand(v, 'A')).toEqual({ lo: 7, hi: 7 });
    expect(isKnownGift(v, 'A', 3)).toBe(true);
    expect(isKnownGift(v, 'A', 1)).toBe(false);
  });

  it('내 기여 8칸 + 하한 6이면 확정 완성', () => {
    const v = view({
      myStacked: { A: 8, B: 0, C: 0, D: 0, E: 0 },
      towers: {
        A: pub('A', { milestonesReached: { half: true, complete: false }, minKnownHeight: 6 }),
        B: pub('B'),
        C: pub('C'),
        D: pub('D'),
        E: pub('E'),
      },
    });
    expect(sureCompleteTowers(v)).toEqual(['A']);
  });
});

describe('5개의 탑 더미 pick', () => {
  it.each(['하', '중', '상'] as const)('%s는 확정 완성을 가져간다', async (tier) => {
    const v = view({
      myStacked: { A: 9, B: 0, C: 0, D: 0, E: 0 },
      towers: {
        A: pub('A', { milestonesReached: { half: true, complete: false }, minKnownHeight: 6 }),
        B: pub('B'),
        C: pub('C'),
        D: pub('D'),
        E: pub('E'),
      },
    });
    const action = await pickFiveTowersActionAsync(v, 'dummy', tier, 0);
    expect(action).toEqual({ type: 'stack', tower: 'A', count: 3 });
  });

  it.each(['하', '중', '상'] as const)('%s는 확정 높이 7에 3칸을 안 둔다', async (tier) => {
    const v = view({
      turn: 12,
      myStacked: { A: 7, B: 2, C: 0, D: 0, E: 0 },
      towers: {
        A: pub('A', { milestonesReached: { half: true, complete: false }, minKnownHeight: 6 }),
        B: pub('B'),
        C: pub('C'),
        D: pub('D'),
        E: pub('E'),
      },
    });
    const action = await pickFiveTowersActionAsync(v, 'dummy', tier, 0);
    expect(action).not.toBeNull();
    if (action?.type === 'stack' && action.tower === 'A') {
      expect(action.count).not.toBe(3);
    }
  });

  it('합법 1~3, 완성 탑은 안 고른다', async () => {
    const v = view({
      towers: {
        A: pub('A', { completed: true, completedBy: 'human', milestonesReached: { half: true, complete: true }, minKnownHeight: 11 }),
        B: pub('B'),
        C: pub('C'),
        D: pub('D'),
        E: pub('E'),
      },
    });
    const action = await pickFiveTowersActionAsync(v, 'dummy', '상', 0);
    expect(action?.type).toBe('stack');
    if (action?.type === 'stack') {
      expect(action.tower).not.toBe('A');
      expect(action.count).toBeGreaterThanOrEqual(1);
      expect(action.count).toBeLessThanOrEqual(3);
    }
  });
});
