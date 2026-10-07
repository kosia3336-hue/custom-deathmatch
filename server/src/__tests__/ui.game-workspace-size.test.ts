import { describe, expect, it } from 'vitest';
import { gameWorkspaceHeight } from '../../../lib/gameWorkspaceSize';

describe('게임 화면 높이와 전체 스크롤', () => {
  it('점수와 5줄 메모가 있어도 판을 최소 높이 아래로 압축하지 않는다', () => {
    const required = gameWorkspaceHeight({
      viewport: 265,
      frameChrome: 345,
      stageMinimum: 320,
    });
    expect(required - 345).toBeGreaterThanOrEqual(320);
    expect(required).toBeGreaterThan(265);
  });
  it('상하 도킹과 큰 입력판 공간을 별도로 확보한다', () => {
    const required = gameWorkspaceHeight({
      viewport: 280,
      frameChrome: 150,
      stageMinimum: 360,
      stageContent: 440,
      docks: 260,
      workspaceChrome: 32,
    });
    expect(required - 150 - 260 - 32).toBeGreaterThanOrEqual(440);
    expect(required).toBe(882);
  });
  it('충분한 화면에서는 기존 화면 높이를 유지하고 메모가 줄면 여분 높이를 반환한다', () => {
    const expanded = gameWorkspaceHeight({ viewport: 600, frameChrome: 400, stageMinimum: 320 });
    const collapsed = gameWorkspaceHeight({ viewport: 600, frameChrome: 100, stageMinimum: 320 });
    expect(expanded).toBe(720);
    expect(collapsed).toBe(600);
  });
});
