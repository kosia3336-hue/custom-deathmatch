import { describe, it, expect } from 'vitest';
import { guildContribDailyRange, inGuildContribDaily } from '@shared/rank/kst.js';

function kst(isoLocal: string): Date {
  return new Date(`${isoLocal}+09:00`);
}

function ymdhm(d: Date): string {
  const ymd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const hm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${ymd} ${hm}`;
}

describe('길드 공헌도 일간 = 직전 랭크 세션', () => {
  it('수 낮: 화 21:00 ~ 수 01:00. 월 밤·수 밤은 빠짐', () => {
    const now = kst('2026-08-26T15:00:00');
    const { start, end } = guildContribDailyRange(now);
    expect(ymdhm(start)).toBe('2026-08-25 21:00');
    expect(ymdhm(end)).toBe('2026-08-26 01:00');
    expect(inGuildContribDaily(kst('2026-08-25T21:00:00'), now)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-26T00:30:00'), now)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-24T22:00:00'), now)).toBe(false);
    expect(inGuildContribDaily(kst('2026-08-26T21:10:00'), now)).toBe(false);
  });

  it('수 21:10이 되어도 오늘 세션으로 안 바뀜', () => {
    const now = kst('2026-08-26T21:10:00');
    const { start, end } = guildContribDailyRange(now);
    expect(ymdhm(start)).toBe('2026-08-25 21:00');
    expect(ymdhm(end)).toBe('2026-08-26 01:00');
    expect(inGuildContribDaily(kst('2026-08-26T21:05:00'), now)).toBe(false);
    expect(inGuildContribDaily(kst('2026-08-25T22:00:00'), now)).toBe(true);
  });

  it('목 00:30(수 세션 진행 중)도 아직 화 밤', () => {
    const now = kst('2026-08-27T00:30:00');
    const { start, end } = guildContribDailyRange(now);
    expect(ymdhm(start)).toBe('2026-08-25 21:00');
    expect(ymdhm(end)).toBe('2026-08-26 01:00');
    expect(inGuildContribDaily(kst('2026-08-26T21:40:00'), now)).toBe(false);
  });

  it('목 01:00부터 수 밤이 일간', () => {
    const now = kst('2026-08-27T01:00:00');
    const { start, end } = guildContribDailyRange(now);
    expect(ymdhm(start)).toBe('2026-08-26 21:00');
    expect(ymdhm(end)).toBe('2026-08-27 01:00');
    expect(inGuildContribDaily(kst('2026-08-26T21:40:00'), now)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-25T22:00:00'), now)).toBe(false);
  });

  it('토 00:30은 아직 금 세션 중이라 목 밤', () => {
    const now = kst('2026-08-29T00:30:00');
    const { start, end } = guildContribDailyRange(now);
    expect(ymdhm(start)).toBe('2026-08-27 21:00');
    expect(ymdhm(end)).toBe('2026-08-28 01:00');
  });

  it('토요일 일간은 금요일 밤. 토 낮·밤은 아직 안 넣음', () => {
    const sat = kst('2026-08-29T15:00:00');
    const { start, end } = guildContribDailyRange(sat);
    expect(ymdhm(start)).toBe('2026-08-28 21:00');
    expect(ymdhm(end)).toBe('2026-08-29 01:00');
    expect(inGuildContribDaily(kst('2026-08-28T22:00:00'), sat)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-29T02:00:00'), sat)).toBe(false);
    expect(inGuildContribDaily(kst('2026-08-29T21:10:00'), sat)).toBe(false);
  });

  it('일요일 일간은 토+일 (하루)', () => {
    const sun = kst('2026-08-30T18:00:00');
    const { start } = guildContribDailyRange(sun);
    expect(ymdhm(start)).toBe('2026-08-29 01:00');
    expect(inGuildContribDaily(kst('2026-08-29T14:00:00'), sun)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-30T12:00:00'), sun)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-28T22:00:00'), sun)).toBe(false);
  });

  it('월 00:30까지는 주말 하루, 월 01:00에 주말이 확정', () => {
    const lateSun = kst('2026-08-31T00:30:00');
    expect(ymdhm(guildContribDailyRange(lateSun).start)).toBe('2026-08-29 01:00');
    expect(inGuildContribDaily(kst('2026-08-30T23:00:00'), lateSun)).toBe(true);

    const mon = kst('2026-08-31T10:00:00');
    const { start, end } = guildContribDailyRange(mon);
    expect(ymdhm(start)).toBe('2026-08-29 01:00');
    expect(ymdhm(end)).toBe('2026-08-31 01:00');
    expect(inGuildContribDaily(kst('2026-08-31T00:20:00'), mon)).toBe(true);
    expect(inGuildContribDaily(kst('2026-08-31T21:10:00'), mon)).toBe(false);
  });

  it('화 01:00부터 월 밤(21:00~01:00)', () => {
    const now = kst('2026-09-01T01:00:00');
    const { start, end } = guildContribDailyRange(now);
    expect(ymdhm(start)).toBe('2026-08-31 21:00');
    expect(ymdhm(end)).toBe('2026-09-01 01:00');
  });
});
