import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';
import { countAiTurns, winnerSideFromKifu } from '../socket/superAiPersist.js';

describe('슈퍼 AI 기보 집계', () => {
  it('byAi 수를 센다', () => {
    expect(countAiTurns({ actions: [{ byAi: true }, { byAi: false }, {}] })).toBe(1);
    expect(countAiTurns({})).toBe(0);
  });

  it('사목 승자는 winType', () => {
    expect(
      winnerSideFromKifu(GAME_IDS.FOUR_GRAVITY, { winType: 'black' }, []),
    ).toBe('black');
    expect(
      winnerSideFromKifu(GAME_IDS.FOUR_GRAVITY, { winType: 'neutral' }, []),
    ).toBe('neutral');
  });

  it('넘버4 라운드 안의 byAi도 센다', () => {
    expect(countAiTurns({
      actions: [
        {
          round: 1,
          players: {
            a: { byAi: true },
            b: { byAi: true },
          },
        },
      ],
    })).toBe(2);
  });

  it('넘버4 승자는 1P·2P', () => {
    const kifu = {
      players: {
        'id-1': { nickname: '갑 (1P)' },
        'id-1_p2': { nickname: '갑 (2P)' },
      },
    };
    expect(
      winnerSideFromKifu(
        GAME_IDS.NUMBER_FOUR,
        kifu,
        [{ playerId: 'id-1_p2', nickname: '갑 (2P)', rank: 1, score: 1 }],
      ),
    ).toBe('second');
  });

  it('양면장기는 승자 닉으로 선·후를 가린다', () => {
    const kifu = {
      players: { first: { nickname: '갑 (선)' }, second: { nickname: '갑 (후)' } },
    };
    expect(
      winnerSideFromKifu(
        GAME_IDS.DOUBLE_SIDED_CHESS,
        kifu,
        [{ playerId: 'a', nickname: '갑 (후)', rank: 1, score: 1 }],
      ),
    ).toBe('second');
  });
});
