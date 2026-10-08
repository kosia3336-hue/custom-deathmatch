import { describe, expect, it } from 'vitest';
import { bankProgressIndex, needsBankZeroBetConfirmation } from '../../../lib/bankGameUi';
import { zeroBet } from '../../../shared/types/bank-game';

describe('은행놀이 진행 및 0원 제출 확인', () => {
  it('실제 서버 단계에서 네 단계 진행 상황을 선택한다', () => {
    expect(
      ['firstSubmit', 'firstReveal', 'secondSubmit', 'reveal', 'roundEnd', 'finished'].map(
        (phase) => bankProgressIndex(phase as Parameters<typeof bankProgressIndex>[0]),
      ),
    ).toEqual([0, 1, 2, 3, 3, 4]);
  });
  it('선의 총 0원 제출에만 확인이 필요하다', () => {
    expect(needsBankZeroBetConfirmation('firstSubmit', zeroBet())).toBe(true);
    expect(needsBankZeroBetConfirmation('secondSubmit', zeroBet())).toBe(false);
    expect(needsBankZeroBetConfirmation('firstReveal', zeroBet())).toBe(false);
    expect(needsBankZeroBetConfirmation('roundEnd', zeroBet())).toBe(false);
  });
  it('1000원은 0장이더라도 다른 액면을 선택하면 0원 경고를 띄우지 않는다', () => {
    for (const denom of [1000, 3000, 5000, 10000] as const)
      expect(needsBankZeroBetConfirmation('firstSubmit', { ...zeroBet(), [denom]: 1 })).toBe(false);
  });
});
