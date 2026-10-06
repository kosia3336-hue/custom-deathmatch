import { describe, expect, it } from 'vitest';
import { formatTurnLabel, seatStage, turnStage } from '../../../lib/gameSeat';

describe('공통 상단 바 차례 표기', () => {
  it.each([
    ['공동 차례 · 타일 넘버 선택', '(공동 차례) 타일 넘버 선택'],
    ['내 차례', '(내 차례)'],
    ['상대 차례 · 중력 선택', '(상대 차례) 중력 선택'],
    ['(공동 차례) 상대 제출 대기', '(공동 차례) 상대 제출 대기'],
    ['튜토리얼', '튜토리얼'],
  ])('%s → %s', (label, expected) => {
    expect(formatTurnLabel(label)).toBe(expected);
    expect(formatTurnLabel(formatTurnLabel(label))).toBe(expected);
  });

  it('기존 자리·차례 문구도 중복 괄호 없이 표시한다', () => {
    const stage = turnStage({ finished: false, isSpectator: false, isMyTurn: false });
    expect(formatTurnLabel(seatStage('후', stage)!)).toBe('후 · (상대 차례)');
  });
});
