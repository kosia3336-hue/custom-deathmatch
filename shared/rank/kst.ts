/** 랭크 큐 운영 시간: 평일 21:00 ~ 익일 01:00 KST / 주말(토·일) 24시간 (서버·클라 공통) */

const HOUR_MS = 60 * 60 * 1000;

export function getKstHourMinute(d = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = Number(p.value);
    if (p.type === 'minute') minute = Number(p.value);
  }
  return { hour, minute };
}

function isKstWeekend(d = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'long',
  }).format(d);
  if (weekday === 'Saturday' || weekday === 'Sunday') return true;

  // 공휴일 한정 24시간 운영
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  let year = 0, month = 0, day = 0;
  for (const p of dateParts) {
    if (p.type === 'year') year = Number(p.value);
    if (p.type === 'month') month = Number(p.value);
    if (p.type === 'day') day = Number(p.value);
  }
  const HOLIDAY_24H_DATES = [
    [2026, 6, 3],
    [2026, 7, 17],
  ];
  return HOLIDAY_24H_DATES.some(([y, m, d]) => year === y && month === m && day === d);
}

/** 랭크 시즌 잠금 스위치 — true 면 요일/시간과 무관하게 랭크 큐 닫힘 */
export const RANK_QUEUE_LOCKED = false;

export function isRankQueueOpen(d = new Date()): boolean {
  if (RANK_QUEUE_LOCKED) return false;
  if (isKstWeekend(d)) return true;
  const { hour, minute } = getKstHourMinute(d);
  const mins = hour * 60 + minute;
  return mins >= 21 * 60 || mins < 1 * 60;
}

/** 평일 운영 종료 직전(00:59 KST) — 토스트용. 주말은 항상 false. */
export function isRankQueueLastMinuteKst(d = new Date()): boolean {
  if (isKstWeekend(d)) return false;
  const { hour, minute } = getKstHourMinute(d);
  return hour === 0 && minute === 59;
}

/** 신규 큐 진입 허용 여부 */
export function isRankQueueAcceptingNewJoins(d = new Date()): boolean {
  return isRankQueueOpen(d) && !isRankQueueLastMinuteKst(d);
}

/** 길드 랭킹 기간 앵커. 랭크 종료 01:00 이전이면 전날(전 주/전 달). */
export function guildRankPeriodAnchor(d = new Date()): Date {
  return new Date(d.getTime() - HOUR_MS);
}

/** 길드 랭킹 정산 시각: 01:00~01:59 KST (랭크 종료). */
export function isGuildRankSettleHourKst(d = new Date()): boolean {
  return getKstHourMinute(d).hour === 1;
}

/** 이 키부터 주간 GP·뽑기권 지급. 이전 주(`w:2026-08-17`)는 스킵. */
export const GUILD_RANK_FIRST_WEEKLY_PAYOUT_KEY = 'w:2026-08-24';
