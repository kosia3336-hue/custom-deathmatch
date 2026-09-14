import { describe, expect, it, vi } from 'vitest';
import {
  formatShareDateTime,
  resultCardContent,
  resultShareText,
  resultSharePayload,
} from '../../../lib/resultShare';
import { shareImageOrText, shareOrCopy, type ImageShareTargets, type ShareTargets } from '../../../lib/share';
import { GAME_IDS, resolveAbstractAiDifficulty } from '@shared/types/game.js';

describe('공개 전적 요약', () => {
  it('게임명·결과·시간·턴만 넣고 링크는 넣지 않는다', () => {
    const value = resultSharePayload({ gameName: '사중력 사목', result: '승리', playTimeMs: 125000, totalTurns: 12 });
    expect(value.text).toContain('2분 5초 · 12턴');
    expect(value).not.toHaveProperty('url');
    expect(value.text).not.toMatch(/https?:|\/share\//);
  });
  it('대전 상대와 대전 일시(KST), 랭크전을 넣는다', () => {
    const text = resultShareText({
      gameName: '사중력 사목',
      result: '승리',
      playTimeMs: 125000,
      totalTurns: 12,
      opponents: [{ name: '홍길동' }],
      playedAt: '2026-09-12T12:30:00Z',
    });
    expect(text).toBe('커스텀 데스매치 · 사중력 사목\n승리 vs 홍길동\n2026.09.12 21:30 · 플레이 2분 5초 · 12턴');
    expect(
      resultShareText({ gameName: '넘버4', result: '패배', playTimeMs: 0, totalTurns: 0, isRanked: true }).split('\n')[0],
    ).toBe('커스텀 데스매치 · 넘버4 · 랭크전');
    expect(
      resultShareText({
        gameName: 'a',
        result: '패배',
        playTimeMs: 0,
        totalTurns: 0,
        opponents: ['가', '나', '다', '라', '마'].map((name) => ({ name })),
      }),
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
        opponents: Array.from({ length: 20 }, () => ({ name: 'b'.repeat(500) })),
        playedAt: 'garbage',
      }).length,
    ).toBeLessThan(200);
  });
  it('어려움은 지정된 두 게임만 중지하고 다른 엔진의 설정은 유지한다', () => {
    expect(resolveAbstractAiDifficulty('hard', GAME_IDS.FOUR_GRAVITY)).toBe('normal');
    expect(resolveAbstractAiDifficulty('hard', GAME_IDS.DOUBLE_SIDED_CHESS)).toBe('normal');
    expect(resolveAbstractAiDifficulty('hard', GAME_IDS.TRIPLE_GOMOKU)).toBe('hard');
  });
});

describe('결과 카드 글자', () => {
  const base = { gameName: '콰트로', playTimeMs: 750000, totalTurns: 4, playedAt: '2026-09-14T12:30:00Z' };
  it('이긴 본인 이름에 승을 붙이고, 랭크전·일시·시간·턴을 담는다', () => {
    expect(
      resultCardContent({ ...base, result: '승리', selfName: '쇼비', opponents: [{ name: '???' }], isRanked: true }),
    ).toEqual({
      gameName: '콰트로',
      resultLabel: '승리',
      tone: 'win',
      isRanked: true,
      vsParts: [
        { kind: 'name', text: '쇼비', won: true },
        { kind: 'sep', text: ' vs ' },
        { kind: 'name', text: '???', won: false },
      ],
      meta: '2026.09.14 21:30 · 플레이 12분 30초 · 4턴',
    });
  });
  it('졌으면 이긴 상대에게만 승을 붙이고 본인에게는 붙이지 않는다', () => {
    const lost = resultCardContent({ ...base, result: '패배', selfName: '나', opponents: [{ name: '가', won: true }] });
    expect(lost.vsParts).toEqual([
      { kind: 'name', text: '나', won: false },
      { kind: 'sep', text: ' vs ' },
      { kind: 'name', text: '가', won: true },
    ]);
    expect(lost.isRanked).toBe(false);
    expect(lost.tone).toBe('other');
    const many = resultCardContent({
      ...base,
      result: '패배',
      opponents: [{ name: 'a' }, { name: 'b', won: true }, { name: 'c' }, { name: 'd' }, { name: 'e' }],
    });
    expect(many.vsParts.map((p) => (p.kind === 'name' && p.won ? `${p.text}(승)` : p.text)).join('')).toBe(
      'vs a, b(승), c 외 2명',
    );
  });
  it('무승부는 누구에게도 승을 붙이지 않고, 이름이 없으면 비운다', () => {
    const draw = resultCardContent({ ...base, result: '무승부', selfName: '나', opponents: [{ name: '가' }] });
    expect(draw.tone).toBe('draw');
    expect(draw.vsParts.some((p) => p.kind === 'name' && p.won)).toBe(false);
    expect(resultCardContent({ ...base, result: '완료' }).vsParts).toEqual([]);
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

describe('결과 카드 이미지 공유', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'card.jpg', { type: 'image/jpeg' });
  const fallback = { title: '커스텀 데스매치 전적', text: '요약' };
  const targets = (over: Partial<ImageShareTargets>): ImageShareTargets => ({
    native: null,
    web: null,
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    files: null,
    imageClipboard: null,
    makeClipboardItem: null,
    ...over,
  });

  it('앱은 이미지를 캐시에 써서 그 파일만 공유한다', async () => {
    const native = { share: vi.fn().mockResolvedValue({}) };
    const files = { writeFile: vi.fn().mockResolvedValue({ uri: 'file:///cache/card.jpg' }) };
    expect(await shareImageOrText(file, fallback, targets({ native, files }))).toBe('shared');
    expect(files.writeFile).toHaveBeenCalledWith({ path: 'card.jpg', data: 'AQID', directory: 'CACHE' });
    expect(native.share).toHaveBeenCalledWith({ files: ['file:///cache/card.jpg'], dialogTitle: '공유하기' });
  });
  it('파일 플러그인이 없는 이전 앱은 링크 없는 글로 공유한다', async () => {
    const native = { share: vi.fn().mockResolvedValue({}) };
    expect(await shareImageOrText(file, fallback, targets({ native }))).toBe('shared');
    expect(native.share).toHaveBeenCalledWith({ title: '커스텀 데스매치 전적', text: '요약', dialogTitle: '공유하기' });
  });
  it('브라우저는 파일 공유가 되면 이미지만 보낸다', async () => {
    const web = { share: vi.fn().mockResolvedValue(undefined), canShare: vi.fn().mockReturnValue(true) };
    expect(await shareImageOrText(file, fallback, targets({ web }))).toBe('shared');
    expect(web.share).toHaveBeenCalledWith({ files: [file] });
  });
  it('파일 공유가 안 되면 이미지를 복사하고, 그것도 안 되면 글을 복사한다', async () => {
    const web = { share: vi.fn(), canShare: () => false };
    const imageClipboard = { write: vi.fn().mockResolvedValue(undefined) };
    const makeClipboardItem = (blob: Blob) => ({ blob }) as unknown as ClipboardItem;
    expect(await shareImageOrText(file, fallback, targets({ web, imageClipboard, makeClipboardItem }))).toBe('copied-image');
    expect(imageClipboard.write).toHaveBeenCalledWith([{ blob: file }]);
    expect(web.share).not.toHaveBeenCalled();
    const t = targets({ web });
    expect(await shareImageOrText(file, fallback, t)).toBe('copied');
    expect(t.clipboard!.writeText).toHaveBeenCalledWith('요약');
  });
  it('시트를 닫으면 글 공유로 넘어가지 않고, 이미지를 못 만들었으면 글로 공유한다', async () => {
    const web = {
      share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })),
      canShare: () => true,
    };
    expect(await shareImageOrText(file, fallback, targets({ web }))).toBe('cancelled');
    expect(web.share).toHaveBeenCalledTimes(1);
    const native = { share: vi.fn().mockResolvedValue({}) };
    const files = { writeFile: vi.fn() };
    expect(await shareImageOrText(null, fallback, targets({ native, files }))).toBe('shared');
    expect(files.writeFile).not.toHaveBeenCalled();
  });
});
