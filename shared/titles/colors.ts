/**
 * 칭호 색 팔레트 — DB enum `title_color`, globals.css `--title-*`, TitleBadge 와 1:1.
 */
export const TITLE_COLORS = [
  // 기존 16
  'coral', 'amber', 'emerald', 'sky', 'violet', 'pink',
  'lime', 'rose', 'cyan', 'orange', 'fuchsia', 'teal',
  'yellow', 'indigo', 'slate', 'gold',
  // 확장 26
  'red', 'blue', 'purple', 'mint', 'lavender', 'bronze',
  'silver', 'navy', 'maroon', 'crimson', 'ruby', 'sapphire',
  'azure', 'jade', 'forest', 'olive', 'peach', 'magenta',
  'plum', 'wine', 'copper', 'charcoal', 'midnight', 'ocean',
  'spring', 'sunset', 'honey', 'grape',
] as const;

export type TitleColor = (typeof TITLE_COLORS)[number];

/** CSS 변수명 → hex (app/globals.css 와 동기화) */
export const TITLE_COLOR_HEX: Record<TitleColor, string> = {
  coral: '#f43f5e',
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  pink: '#ec4899',
  lime: '#84cc16',
  rose: '#fb7185',
  cyan: '#06b6d4',
  orange: '#f97316',
  fuchsia: '#d946ef',
  teal: '#14b8a6',
  yellow: '#ca8a04',
  indigo: '#4f46e5',
  slate: '#475569',
  gold: '#b8860b',
  red: '#dc2626',
  blue: '#2563eb',
  purple: '#9333ea',
  mint: '#2dd4bf',
  lavender: '#a78bfa',
  bronze: '#a16207',
  silver: '#64748b',
  navy: '#1e3a8a',
  maroon: '#991b1b',
  crimson: '#be123c',
  ruby: '#e11d48',
  sapphire: '#1d4ed8',
  azure: '#0284c7',
  jade: '#059669',
  forest: '#166534',
  olive: '#65a30d',
  peach: '#ea580c',
  magenta: '#c026d3',
  plum: '#86198f',
  wine: '#7f1d1d',
  copper: '#b45309',
  charcoal: '#374151',
  midnight: '#312e81',
  ocean: '#0369a1',
  spring: '#16a34a',
  sunset: '#c2410c',
  honey: '#d97706',
  grape: '#6b21a8',
};
