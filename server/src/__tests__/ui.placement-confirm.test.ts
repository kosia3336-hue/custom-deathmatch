import { describe, expect, it } from 'vitest';
import { tapPlacement } from '../../../lib/placementConfirm';

describe('착수 두 번 탭', () => {
  it('확인이 필요 없으면(마우스) 첫 탭에 둔다', () => {
    expect(tapPlacement(null, '2,3', false)).toEqual({ kind: 'commit', key: '2,3' });
  });

  it('터치 첫 탭은 자리만 보여 준다', () => {
    expect(tapPlacement(null, '2,3', true)).toEqual({ kind: 'arm', key: '2,3' });
  });

  it('보여 주던 자리를 다시 누르면 둔다', () => {
    expect(tapPlacement('2,3', '2,3', true)).toEqual({ kind: 'commit', key: '2,3' });
  });

  it('다른 자리를 누르면 보여 주는 자리만 옮긴다', () => {
    expect(tapPlacement('2,3', '4,1', true)).toEqual({ kind: 'arm', key: '4,1' });
  });
});
