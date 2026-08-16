import type { TitleColor } from '@/lib/supabase/database.types';

export function formatGachaPercent(rate: number): string {
  if (rate <= 0) return '—';
  const pct = rate * 100;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(3)}%`;
  return `${pct.toFixed(4)}%`;
}

export function effectPreviewColor(key: string): TitleColor {
  if (key === 'issen') return 'silver';
  if (key === 'seongha') return 'midnight';
  if (key === 'sakura') return 'pink';
  if (key === 'frost') return 'cyan';
  if (key === 'lightning') return 'azure';
  if (key === 'wave') return 'ocean';
  if (key === 'dojang') return 'crimson';
  return 'gold';
}
