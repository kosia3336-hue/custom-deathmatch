/** 랭크 큐 운영 시간: 평일 21:00 ~ 익일 01:00 KST / 주말(토·일) 24시간 (서버·클라 공통) */

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

  // 2026-06-03 공휴일 한정 24시간 운영
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
  return year === 2026 && month === 6 && day === 3;
}

export function isRankQueueOpen(d = new Date()): boolean {
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
