import { describe, it, expect } from 'vitest';
import {
  guildRankPeriodAnchor,
  isGuildRankSettleHourKst,
} from '@shared/rank/kst.js';

describe('길드 랭킹 기간·정산 시각 (01:00 KST)', () => {
  it('월요일 00:30 KST는 아직 전 주, 01:00에 새 주', () => {
    // 2026-08-24 월 00:30 KST = 2026-08-23T15:30:00Z
    const before = guildRankPeriodAnchor(new Date('2026-08-23T15:30:00.000Z'));
    expect(before.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })).toBe('2026-08-23');

    // 2026-08-24 월 01:00 KST = 2026-08-23T16:00:00Z
    const after = guildRankPeriodAnchor(new Date('2026-08-23T16:00:00.000Z'));
    expect(after.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })).toBe('2026-08-24');
  });

  it('정산은 01시대만', () => {
    expect(isGuildRankSettleHourKst(new Date('2026-08-23T15:30:00.000Z'))).toBe(false);
    expect(isGuildRankSettleHourKst(new Date('2026-08-23T16:00:00.000Z'))).toBe(true);
    expect(isGuildRankSettleHourKst(new Date('2026-08-23T16:59:00.000Z'))).toBe(true);
    expect(isGuildRankSettleHourKst(new Date('2026-08-23T17:00:00.000Z'))).toBe(false);
  });
});
