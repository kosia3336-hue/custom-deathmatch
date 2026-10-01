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
    // 추석 연휴 (토요일인 9/26 은 주말이라 따로 적지 않는다)
    [2026, 9, 24],
    [2026, 9, 25],
    // 개천절 대체휴일 (10/3 이 토요일이라 월요일로 밀렸다)
    [2026, 10, 5],
    // 한글날
    [2026, 10, 9],
  ];
  return HOLIDAY_24H_DATES.some(([y, m, d]) => year === y && month === m && day === d);
}

/** 주말 또는 공휴일 = 24시간 운영일. 길드전도 같은 목록을 쓴다. */
export function isKstFullDay(d = new Date()): boolean {
  return isKstWeekend(d);
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

const KST_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function kstYmd(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function kstDowSun0(d: Date): number {
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(d);
  return KST_DOW[w] ?? 0;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function kstInstant(ymd: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+09:00`);
}

/**
 * 길드 공헌도 일간 창. 달력 00:00이 아니라 직전 랭크 세션.
 * - 평일: 전날 21:00 ~ 그날 01:00 KST. 21:00가 되어도 오늘 세션으로 안 바뀜(다음날 01:00에 교체).
 * - 토요일: 금요일 밤(금 21:00 ~ 토 01:00).
 * - 일요일~월요일 01:00 전: 토·일을 하루(토 01:00 ~ 지금).
 * - 월요일 01:00 ~ 화요일 01:00: 끝난 주말(토 01:00 ~ 월 01:00).
 */
export function guildContribDailyRange(now = new Date()): { start: Date; end: Date } {
  const ymd = kstYmd(now);
  const { hour } = getKstHourMinute(now);
  const dow = kstDowSun0(now);

  if (dow === 0 || (dow === 1 && hour < 1)) {
    const sunYmd = dow === 0 ? ymd : addDaysYmd(ymd, -1);
    return { start: kstInstant(addDaysYmd(sunYmd, -1), 1), end: now };
  }

  if (dow === 1 || (dow === 2 && hour < 1)) {
    const monYmd = dow === 1 ? ymd : addDaysYmd(ymd, -1);
    return {
      start: kstInstant(addDaysYmd(monYmd, -2), 1),
      end: kstInstant(monYmd, 1),
    };
  }

  if (dow === 6 && hour >= 1) {
    return {
      start: kstInstant(addDaysYmd(ymd, -1), 21),
      end: kstInstant(ymd, 1),
    };
  }

  const endYmd = hour < 1 ? addDaysYmd(ymd, -1) : ymd;
  return {
    start: kstInstant(addDaysYmd(endYmd, -1), 21),
    end: kstInstant(endYmd, 1),
  };
}

export function inGuildContribDaily(at: Date | string | number, now = new Date()): boolean {
  const t = typeof at === 'number' ? at : Date.parse(String(at));
  if (!Number.isFinite(t)) return false;
  const { start, end } = guildContribDailyRange(now);
  return t >= start.getTime() && t < end.getTime();
}
