import type { GuildV4PayoutKind } from './types';

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function formatKoYmd(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

/** `w:YYYY-MM-DD` / `m:YYYY-MM` → 화면용 기간 문구 */
export function formatGuildRankPeriodLabel(kind: GuildV4PayoutKind, periodKey: string): string {
  if (kind === 'weekly') {
    const mon = periodKey.slice(2);
    const sun = addDaysYmd(mon, 6);
    const y = mon.slice(0, 4);
    return `${y}년\n${formatKoYmd(mon)} ~ ${formatKoYmd(sun)}`;
  }
  const [y, mo] = periodKey.slice(2).split('-');
  return `${y}년\n${Number(mo)}월`;
}
