/**
 * CDP (Custom Deathmatch Point) 포맷 / 라벨 상수.
 * UI 어디서든 동일하게 노출하려면 본 모듈을 통해 출력한다.
 */

export const CDP_LABEL = 'CDP';
export const CDP_ICON = '🟡';

export function formatCdp(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '0';
  return Math.trunc(v).toLocaleString('ko-KR');
}

/** 숫자 + 단위. 예: `1,250 CDP` */
export function formatCdpWithUnit(n: number | null | undefined): string {
  return `${formatCdp(n)} ${CDP_LABEL}`;
}

/** 부호 포함. 예: `+15`, `−500` */
export function formatCdpDelta(n: number): string {
  if (n > 0) return `+${formatCdp(n)}`;
  if (n < 0) return `−${formatCdp(-n)}`;
  return '0';
}
