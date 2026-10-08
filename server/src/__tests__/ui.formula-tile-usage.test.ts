import { describe, expect, it } from 'vitest';
import { formulaTileUsage } from '../../../lib/formulaTileUsage';

describe('수식완성 숫자 타일 사용 상태', () => {
  it('중복된 숫자를 실제 카드 수만큼만 할당한다', () => {
    expect(formulaTileUsage('3+3+3', [3, 1, 3, 1])).toEqual({
      usedIndices: [0, 2],
      invalidNumbers: ['3'],
    });
  });
  it('클릭한 중복 숫자 카드의 위치를 유지한다', () => {
    expect(formulaTileUsage('1+3', [3, 1, 3, 1], [3, 2]).usedIndices).toEqual([3, 2]);
  });
  it('지운 숫자와 초기화한 수식의 카드를 다시 사용할 수 있다', () => {
    expect(formulaTileUsage('1+', [3, 1, 3, 1], [3, 2]).usedIndices).toEqual([3]);
    expect(formulaTileUsage('', [3, 1, 3, 1], [3, 2]).usedIndices).toEqual([]);
  });
  it('키보드에서 수정하거나 붙여넣은 숫자도 대응시킨다', () => {
    expect(formulaTileUsage('(1+1)×(3+3)', [3, 1, 3, 1]).usedIndices).toEqual([1, 3, 0, 2]);
  });
  it('이어붙이기와 제시되지 않은 숫자는 제출할 수 없는 값으로 구분한다', () => {
    expect(formulaTileUsage('1 3+9', [3, 1, 3, 1])).toEqual({
      usedIndices: [],
      invalidNumbers: ['13', '9'],
    });
  });
  it('서버 숫자 파서와 같이 선행 0을 값으로 정규화한다', () => {
    expect(formulaTileUsage('01+3', [1, 3]).usedIndices).toEqual([0, 1]);
  });
});
