import { describe, expect, it, vi } from 'vitest';
import { resultShareText, resultSharePayload } from '../../../lib/resultShare';
import { shareOrCopy, type ShareTargets } from '../../../lib/share';
import { GAME_IDS, resolveAbstractAiDifficulty } from '@shared/types/game.js';

describe('공개 전적 요약', () => {
  it('게임명·결과·시간·턴만 포함하고 개인 로그가 아닌 로비로 연결한다', () => {
    const value = resultSharePayload(
      { gameName: '사중력 사목', result: '승리', playTimeMs: 125000, totalTurns: 12 },
      'https://example.com',
    );
    expect(value.text).toContain('2분 5초 · 12턴');
    expect(value.url).toBe('https://example.com/lobby');
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
      resultSharePayload(
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

describe('공유 시트', () => {
  const payload = { title: '제목', text: '요약', url: 'https://example.com/lobby' };
  const targets = (over: Partial<ShareTargets>): ShareTargets => ({
    native: null,
    web: null,
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    ...over,
  });

  it('앱에서는 네이티브 공유를 쓰고 브라우저 공유는 건드리지 않는다', async () => {
    const native = { share: vi.fn().mockResolvedValue({}) };
    const web = { share: vi.fn() };
    expect(await shareOrCopy(payload, targets({ native, web }))).toBe('shared');
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining({ text: '요약', url: payload.url }));
    expect(web.share).not.toHaveBeenCalled();
  });
  it('시트를 닫으면 복사로 넘어가지 않는다', async () => {
    const native = { share: vi.fn().mockRejectedValue(new Error('Share canceled')) };
    const t = targets({ native });
    expect(await shareOrCopy(payload, t)).toBe('cancelled');
    expect(t.clipboard!.writeText).not.toHaveBeenCalled();
    const web = { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) };
    expect(await shareOrCopy(payload, targets({ web }))).toBe('cancelled');
  });
  it('공유를 못 하면 글과 링크를 복사한다', async () => {
    const t = targets({ web: { share: vi.fn(), canShare: () => false } });
    expect(await shareOrCopy(payload, t)).toBe('copied');
    expect(t.clipboard!.writeText).toHaveBeenCalledWith('요약\nhttps://example.com/lobby');
    const failing = targets({ native: { share: vi.fn().mockRejectedValue(new Error('boom')) } });
    expect(await shareOrCopy(payload, failing)).toBe('copied');
    expect(await shareOrCopy(payload, targets({ clipboard: null }))).toBe('failed');
  });
});
