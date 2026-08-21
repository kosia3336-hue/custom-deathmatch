import { describe, it, expect } from 'vitest';
import {
  maxSpend,
  minExtraDigits,
  pickSilperBnwActionAsync,
  secondCandidates,
  silperScoreRace,
  type SilperDummyView,
} from '../dummy/ai/silper-bnw.js';
import { SBNW_INITIAL_TILES, type SBNWTile } from '@shared/types/silper-bnw.js';

function fullPool(): Record<SBNWTile, number> {
  return { ...SBNW_INITIAL_TILES };
}

function view(over: Partial<SilperDummyView> & Pick<SilperDummyView, 'phase'>): SilperDummyView {
  return {
    gameOver: false,
    round: 1,
    rematchIndex: 0,
    myId: 'dummy',
    oppId: 'human',
    firstPlayerId: 'human',
    my: { score: 0, tiles: fullPool(), tileCount: 19, submitted: false },
    opp: { score: 0, tileCount: 18, submitted: true },
    firstDigits: 1,
    roundHistory: [],
    winner: null,
    turnStartedAt: Date.now(),
    timeLimitSeconds: 180,
    ...over,
  };
}

describe('실퍼 더미 기보 축', () => {
  it('자리 +1은 10 (1 다음 0)', () => {
    expect(minExtraDigits(fullPool(), 2)).toEqual([1, 0]);
    expect(minExtraDigits(fullPool(), 3)).toEqual([1, 0, 0]);
  });

  it('선이 2자리면 1자리 후보는 접기(1장)뿐', () => {
    const cands = secondCandidates(fullPool(), 2, 8);
    const short = cands.filter((t) => t.length < 2);
    expect(short.length).toBeGreaterThanOrEqual(1);
    expect(short.every((t) => t.length === 1)).toBe(true);
    expect(short.some((t) => t[0] === 0)).toBe(true);
    expect(short.some((t) => t.includes(4) && t.length === 1 && t[0] === 4)).toBe(false);
  });

  it('남은 라운드 패이싱: 11R·19장이면 이번 최대 9장', () => {
    expect(maxSpend(19, 11, false)).toBe(9);
  });
});

describe('실퍼 더미 pick', () => {
  it('합법 타일, firstTiles 필드 없음', async () => {
    const v = view({ phase: 'secondSubmit', firstDigits: 1 });
    expect('firstTiles' in v).toBe(false);
    const action = await pickSilperBnwActionAsync(v, 'dummy', '상', 0);
    expect(action?.type).toBe('submitSecond');
    if (action?.type === 'submitSecond') {
      expect(action.tiles.length).toBeGreaterThan(0);
      expect(action.tiles.length).toBeLessThanOrEqual(2);
      expect(action.tiles.every((t) => t >= 0 && t <= 4)).toBe(true);
    }
  });

  it.each(['하', '중', '상'] as const)('선이 2자리면 %s도 짧은 수에 4를 안 쓴다', async (tier) => {
    for (let i = 0; i < 6; i++) {
      const action = await pickSilperBnwActionAsync(
        view({
          phase: 'secondSubmit',
          firstDigits: 2,
          opp: { score: 0, tileCount: 17, submitted: true },
        }),
        'dummy',
        tier,
        0,
      );
      expect(action?.type).toBe('submitSecond');
      if (action?.type === 'submitSecond') {
        if (action.tiles.length < 2) {
          expect(action.tiles).toEqual([0]);
        }
      }
    }
  });

  it.each(['하', '중', '상'] as const)('선이 3자리면 %s가 접을 때는 0 한 장', async (tier) => {
    for (let i = 0; i < 6; i++) {
      const action = await pickSilperBnwActionAsync(
        view({
          phase: 'secondSubmit',
          firstDigits: 3,
          opp: { score: 0, tileCount: 16, submitted: true },
        }),
        'dummy',
        tier,
        0,
      );
      expect(action?.type).toBe('submitSecond');
      if (action?.type === 'submitSecond' && action.tiles.length < 3) {
        expect(action.tiles).toEqual([0]);
      }
    }
  });

  it('점수 레이스가 끝나면 가장 싼 1장', async () => {
    const action = await pickSilperBnwActionAsync(
      view({
        phase: 'secondSubmit',
        round: 10,
        firstDigits: 3,
        my: { score: 0, tiles: fullPool(), tileCount: 19, submitted: false },
        opp: { score: 5, tileCount: 16, submitted: true },
      }),
      'dummy',
      '상',
      0,
    );
    expect(action?.type).toBe('submitSecond');
    if (action?.type === 'submitSecond') expect(action.tiles).toEqual([0]);
  });

  it('선플 초반은 합법', async () => {
    const action = await pickSilperBnwActionAsync(
      view({
        phase: 'firstSubmit',
        firstPlayerId: 'dummy',
        firstDigits: null,
        my: { score: 0, tiles: fullPool(), tileCount: 19, submitted: false },
        opp: { score: 0, tileCount: 19, submitted: false },
      }),
      'dummy',
      '상',
      0,
    );
    expect(action?.type).toBe('submitFirst');
    if (action?.type === 'submitFirst') {
      expect(action.tiles.length).toBeGreaterThan(0);
      expect(action.tiles.length).toBeLessThanOrEqual(9);
      if (action.tiles.length >= 2) expect(action.tiles[0]).not.toBe(0);
    }
  });
});

describe('실퍼 점수 레이스', () => {
  it('0 vs 5 · 2R 남음 → 진 판', () => {
    expect(silperScoreRace(0, 5, 2)).toBe('lost');
  });

  it('5 vs 0 · 2R 남음 → 이긴 판', () => {
    expect(silperScoreRace(5, 0, 2)).toBe('won');
  });

  it('4 vs 5 · 1R 남음 → 동점 가능, 미결', () => {
    expect(silperScoreRace(4, 5, 1)).toBeNull();
  });

  it('3 vs 5 · 1R 남음 → 진 판', () => {
    expect(silperScoreRace(3, 5, 1)).toBe('lost');
  });
});
