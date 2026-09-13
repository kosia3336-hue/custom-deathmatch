import { describe, expect, it, vi } from 'vitest';
import { formatShareDateTime, resultShareText, resultSharePayload } from '../../../lib/resultShare';
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
  it('결과 공유 페이지 경로가 있으면 그 주소로, 사이트 밖 주소는 로비로 연결한다', () => {
    const summary = { gameName: '넘버4', result: '승리', playTimeMs: 0, totalTurns: 0 };
    expect(resultSharePayload(summary, 'https://example.com', '/share/result/abc').url).toBe(
      'https://example.com/share/result/abc',
    );
    expect(resultSharePayload(summary, 'https://example.com', '//evil.example/x').url).toBe(
      'https://example.com/lobby',
    );
    expect(resultSharePayload(summary, 'https://example.com', 'https://evil.example').url).toBe(
      'https://example.com/lobby',
    );
  });
  it('대전 상대와 대전 일시(KST)를 넣는다', () => {
    const text = resultShareText({
      gameName: '사중력 사목',
      result: '승리',
      playTimeMs: 125000,
      totalTurns: 12,
      opponents: ['홍길동'],
      playedAt: '2026-09-12T12:30:00Z',
    });
    expect(text).toBe('커스텀 데스매치 · 사중력 사목\n승리 vs 홍길동\n2026.09.12 21:30 · 플레이 2분 5초 · 12턴');
    expect(
      resultShareText({ gameName: 'a', result: '패배', playTimeMs: 0, totalTurns: 0, opponents: ['가', '나', '다', '라', '마'] }),
    ).toContain('패배 vs 가, 나, 다 외 2명');
    expect(resultShareText({ gameName: 'a', result: '완료', playTimeMs: 0, totalTurns: 0, opponents: [] })).toContain('\n완료\n');
    expect(formatShareDateTime('not a date')).toBeNull();
  });
  it('비정상 숫자와 과도한 텍스트를 제한한다', () => {
    expect(
      resultShareText({
        gameName: 'a'.repeat(1000),
        result: '승리',
        playTimeMs: NaN,
        totalTurns: -1,
        opponents: Array.from({ length: 20 }, () => 'b'.repeat(500)),
        playedAt: 'garbage',
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
    expect(native.share).toHaveBeenCalledWith(
      expect.objectContaining({ text: '요약\nhttps://example.com/lobby' }),
    );
    expect(web.share).not.toHaveBeenCalled();
  });
  it('링크를 따로 넘기지 않고 글 끝에 붙여 메시지 하나로 보낸다', async () => {
    const web = { share: vi.fn().mockResolvedValue(undefined) };
    await shareOrCopy(payload, targets({ web }));
    const sent = web.share.mock.calls[0][0];
    expect(sent).not.toHaveProperty('url');
    expect(sent.text).toBe('요약\nhttps://example.com/lobby');
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
