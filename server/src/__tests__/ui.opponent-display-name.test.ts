import { describe, expect, it } from 'vitest';
import { ANONYMOUS_NICKNAME, opponentDisplayName } from '../../../lib/anonymousOpponents';

describe('게임 화면 상대 표시명', () => {
  it('플레이어 시점에서 익명(???)은 상대로 부른다', () => {
    expect(opponentDisplayName(ANONYMOUS_NICKNAME)).toBe('상대');
  });

  it('실명이면 그대로 둔다 — 내 이름은 가려지지 않으므로 그대로 나온다', () => {
    expect(opponentDisplayName('창조적인플레이')).toBe('창조적인플레이');
  });

  it('이름을 모르면 상대', () => {
    expect(opponentDisplayName(undefined)).toBe('상대');
    expect(opponentDisplayName('')).toBe('상대');
  });

  it('관전자 시점은 두 사람이 모두 ??? 일 수 있어 그대로 둔다', () => {
    expect(opponentDisplayName(ANONYMOUS_NICKNAME, true)).toBe(ANONYMOUS_NICKNAME);
    expect(opponentDisplayName(undefined, true)).toBe('상대');
  });
});
