import { describe, expect, it } from 'vitest';
import { guildRoleCdpBonus } from '../cdp/guildRoleCdpV4.js';

describe('guildRoleCdpBonus', () => {
  it('길드장 20%, 부길드장 5%', () => {
    expect(guildRoleCdpBonus(16, 'owner')).toBe(3);
    expect(guildRoleCdpBonus(16, 'vice_owner')).toBe(1);
    expect(guildRoleCdpBonus(5, 'owner')).toBe(1);
    expect(guildRoleCdpBonus(5, 'vice_owner')).toBe(0);
    expect(guildRoleCdpBonus(16, 'member')).toBe(0);
    expect(guildRoleCdpBonus(0, 'owner')).toBe(0);
  });
});
