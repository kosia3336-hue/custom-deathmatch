/**
 * 타이탄 시범 창: 2026-08-21(금)~08-23(일) KST 22:00 ≤ t < 24:00.
 * 밤 10시~12시. 월~목·그다음 주는 여기 날짜를 바꿔야 한다.
 */

const LIVE_DATES = new Set(['2026-08-21', '2026-08-22', '2026-08-23']);
const HOUR_START = 22;
const HOUR_END = 24;

export const LIVE_DUMMY_NICKNAME = '타이탄';
export const LIVE_DUMMY_TIER = '상' as const;
export const LIVE_DUMMY_SOCKET_ID = 'live-dummy:titan';
export const LIVE_DUMMY_EMAIL = 'dummy_titan@dummy.internal';

export function isLiveDummyEnabled(): boolean {
  const v = (process.env.DUMMY_LIVE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function kstYmd(d: Date): { ymd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  let year = '', month = '', day = '', hour = 0, minute = 0;
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
    if (p.type === 'hour') hour = Number(p.value);
    if (p.type === 'minute') minute = Number(p.value);
  }
  return { ymd: `${year}-${month}-${day}`, hour, minute };
}

/** 이번 주 금·토·일 밤 10시~12시(24시 미만) KST. */
export function isTitanLiveWindow(d = new Date()): boolean {
  const { ymd, hour } = kstYmd(d);
  if (!LIVE_DATES.has(ymd)) return false;
  return hour >= HOUR_START && hour < HOUR_END;
}

export function rejoinDelayMs(): number {
  return (5 + Math.floor(Math.random() * 6)) * 1000;
}
