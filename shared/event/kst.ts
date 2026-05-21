/**
 * 인디언홀덤 (이벤트) 운영 시간 유틸.
 * - 평일(월~금): 01:00 ~ 21:00 KST  (랭크 큐 역방향)
 * - 주말(토·일): 24시간
 *
 * 서버 / 클라이언트 공통. KST = Asia/Seoul.
 */

import { getKstHourMinute } from '../rank/kst';

function isKstWeekend(d: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'long',
  }).format(d);
  return weekday === 'Saturday' || weekday === 'Sunday';
}

/**
 * 이벤트 룸 운영 시간 여부.
 * - 주말: 항상 true
 * - 평일: 01:00 (포함) ~ 21:00 (미포함)
 */
export function isEventRoomOpen(d: Date = new Date()): boolean {
  if (isKstWeekend(d)) return true;
  const { hour, minute } = getKstHourMinute(d);
  const mins = hour * 60 + minute;
  // 01:00(60) <= mins < 21:00(1260)
  return mins >= 60 && mins < 21 * 60;
}

/** 운영 종료 1분 전 (평일 20:59 KST) — 토스트/배너 안내용. 주말은 항상 false. */
export function isEventRoomLastMinuteKst(d: Date = new Date()): boolean {
  if (isKstWeekend(d)) return false;
  const { hour, minute } = getKstHourMinute(d);
  return hour === 20 && minute === 59;
}
