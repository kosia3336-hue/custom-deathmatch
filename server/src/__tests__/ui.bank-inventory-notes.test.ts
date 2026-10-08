import { describe, expect, it } from 'vitest';
import { BANK_INITIAL_INVENTORY } from '../../../shared/types/bank-game';
import {
  initializeBankInventoryNotes,
  updateBankInventoryNote,
  resetBankInventoryNote,
} from '../../../lib/bankInventoryNotes';

describe('은행놀이 라운드별 잔여 메모', () => {
  it('처음에는 최대 수량으로 시작하고 다음 라운드는 이전 메모를 복사한다', () => {
    const first = updateBankInventoryNote({}, 1, 1000, 15);
    const next = initializeBankInventoryNotes(first, 2);
    expect(next[2]).toEqual({ ...BANK_INITIAL_INVENTORY, 1000: 15 });
    expect(next[2]).not.toBe(next[1]);
    expect(initializeBankInventoryNotes(next, 2)).toBe(next);
  });
  it('이전 라운드 수정 및 초기화가 현재 라운드를 변경하지 않는다', () => {
    const first = updateBankInventoryNote({}, 1, 5000, 3);
    const second = initializeBankInventoryNotes(first, 2);
    const edited = updateBankInventoryNote(second, 1, 5000, 1);
    expect(edited[1][5000]).toBe(1);
    expect(edited[2][5000]).toBe(3);
    const reset = resetBankInventoryNote(edited, 1);
    expect(reset[1]).toEqual(BANK_INITIAL_INVENTORY);
    expect(reset[2]).toEqual(second[2]);
  });
  it('장수를 정수 및 권종 한도 안에서 유지하고 잘못된 라운드는 무시한다', () => {
    expect(updateBankInventoryNote({}, 1, 10000, 99)[1][10000]).toBe(2);
    expect(updateBankInventoryNote({}, 1, 3000, -2)[1][3000]).toBe(0);
    expect(updateBankInventoryNote({}, 1, 1000, 3.9)[1][1000]).toBe(3);
    expect(updateBankInventoryNote({}, 1, 1000, NaN)).toEqual({});
    expect(updateBankInventoryNote({}, 0, 1000, 1)).toEqual({});
    expect(resetBankInventoryNote({}, 10)).toEqual({});
  });
});
