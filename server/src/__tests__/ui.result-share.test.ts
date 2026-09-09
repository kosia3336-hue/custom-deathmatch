import { describe, expect, it } from 'vitest';
import { resultShareText, resultShareTemplate } from '../../../lib/resultShare';
import { GAME_IDS, resolveAbstractAiDifficulty } from '@shared/types/game.js';

describe('공개 전적 요약', () => {
  it('게임명·결과·시간·턴만 포함하고 개인 로그가 아닌 로비로 연결한다', () => {
    const value = resultShareTemplate(
      { gameName: '사중력 사목', result: '승리', playTimeMs: 125000, totalTurns: 12 },
      'https://example.com',
    );
    expect(value.text).toContain('2분 5초 · 12턴');
    expect(value.link.webUrl).toBe('https://example.com/lobby');
    expect(value.link.mobileWebUrl).toBe(value.link.webUrl);
    expect(value.objectType).toBe('text');
  });
  it('비정상 숫자와 과도한 텍스트를 제한한다', () => {
    expect(
      resultShareText({
        gameName: 'a'.repeat(1000),
        result: '승리',
        playTimeMs: NaN,
        totalTurns: -1,
      }).length,
    ).toBeLessThan(200);
    expect(() =>
      resultShareTemplate(
        { gameName: 'a', result: '승리', playTimeMs: 0, totalTurns: 0 },
        'javascript:alert(1)',
      ),
    ).toThrow();
  });
  it('어려움은 지정된 두 게임만 중지하고 다른 엔진의 설정은 유지한다', () => {
    expect(resolveAbstractAiDifficulty('hard', GAME_IDS.FOUR_GRAVITY)).toBe('normal');
    expect(resolveAbstractAiDifficulty('hard', GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('normal');
    expect(resolveAbstractAiDifficulty('hard', GAME_IDS.TRIPLE_GOMOKU)).toBe('hard');
  });
});
