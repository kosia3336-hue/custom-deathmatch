export function formatGachaPercent(rate: number): string {
  if (rate <= 0) return '—';
  const pct = rate * 100;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(3)}%`;
  return `${pct.toFixed(4)}%`;
}
