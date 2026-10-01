/**
 * 기간 한정 길드전 운영 창.
 * - 기간: 2026-09-17 01:00 KST ~ 2026-10-01 00:00 KST (끝 시각 미포함)
 * - 평일: 01:00 포함 ~ 21:00 미만 (랭크 큐의 역)
 * - 주말·공휴일: 24시간
 *
 * 기간이 끝나면 방·타일이 사라지고 남은 칩은 GP로 자동 환전된다.
 */

import { getKstHourMinute, isKstFullDay } from '../rank/kst';

export const GUILD_WAR_START_MS = Date.parse('2026-09-17T01:00:00+09:00');
/** 종료(미포함). 9/30 20:59:59 까지 플레이, 10/1 00:00 에 컨텐츠가 사라진다. */
export const GUILD_WAR_END_MS = Date.parse('2026-10-01T00:00:00+09:00');

/** 컨텐츠가 살아 있는 기간인가. 로비 방·길드 타일 노출 조건. */
export function isGuildWarPeriod(d: Date = new Date()): boolean {
  const t = d.getTime();
  return t >= GUILD_WAR_START_MS && t < GUILD_WAR_END_MS;
}

/** 기간이 끝났는가. 자동 환전 트리거. */
export function isGuildWarOver(d: Date = new Date()): boolean {
  return d.getTime() >= GUILD_WAR_END_MS;
}

/** 지금 입장·세트 시작이 되는가 (기간 ∧ 요일 시간). */
export function isGuildWarOpen(d: Date = new Date()): boolean {
  if (!isGuildWarPeriod(d)) return false;
  if (isKstFullDay(d)) return true;
  const { hour, minute } = getKstHourMinute(d);
  const mins = hour * 60 + minute;
  return mins >= 60 && mins < 21 * 60;
}
