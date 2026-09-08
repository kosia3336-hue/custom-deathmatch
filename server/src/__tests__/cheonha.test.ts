import { describe, expect, it } from 'vitest';
import { CHEONHA_NICKNAME, isCheonhaNickname } from '@shared/cheonha.js';

describe('isCheonhaNickname', () => {
  it('운영자 닉만 true', () => {
    expect(CHEONHA_NICKNAME).toBe('천하');
    expect(isCheonhaNickname('천하')).toBe(true);
    expect(isCheonhaNickname('푸린')).toBe(false);
    expect(isCheonhaNickname(null)).toBe(false);
    expect(isCheonhaNickname(undefined)).toBe(false);
  });
});
