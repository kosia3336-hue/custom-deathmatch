import type { SMS2MarkId, SMS2WinType } from '@/shared/types/sun-moon-star-2';

/* ══════════════════════════════════════════════════════════
 * 해달별 II — 프론트 전용 상수
 * (BNW2 색 토큰 계승: 본인 indigo, 상대 amber + 표식 3색)
 * ══════════════════════════════════════════════════════════ */

export interface MarkStyle {
  label: string;
  icon: string;
  /** 기본 카드 배경 (unlit) */
  bgSoft: string;
  /** 점등 시 카드 배경 */
  bgLit: string;
  textSoft: string;
  textLit: string;
  borderSoft: string;
  borderLit: string;
  ringLit: string;
  glowLit: string;
  /** 점등 전용 golden halo shadow (lit glow) */
  haloLit: string;
  /** 본인 기여 숫자 배지 색 */
  chipSelf: string;
  /** MarkRevealPanel 큰 아이콘 글로우 색 */
  bigGlow: string;
}

export const MARK_STYLES: Record<SMS2MarkId, MarkStyle> = {
  sun: {
    label: '해',
    icon: '☀️',
    bgSoft: 'bg-amber-50',
    bgLit: 'bg-linear-to-br from-amber-100 to-orange-200',
    textSoft: 'text-amber-800',
    textLit: 'text-amber-950',
    borderSoft: 'border-amber-200',
    borderLit: 'border-amber-400',
    ringLit: 'ring-amber-300',
    glowLit: 'shadow-[0_0_18px_rgba(251,191,36,0.55)]',
    haloLit: 'shadow-[0_0_24px_rgba(251,191,36,0.6)]',
    chipSelf: 'bg-amber-100 text-amber-900',
    bigGlow: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]',
  },
  moon: {
    label: '달',
    icon: '🌙',
    bgSoft: 'bg-indigo-50',
    bgLit: 'bg-linear-to-br from-indigo-100 to-violet-200',
    textSoft: 'text-indigo-800',
    textLit: 'text-indigo-950',
    borderSoft: 'border-indigo-200',
    borderLit: 'border-indigo-400',
    ringLit: 'ring-indigo-300',
    glowLit: 'shadow-[0_0_18px_rgba(129,140,248,0.55)]',
    haloLit: 'shadow-[0_0_24px_rgba(129,140,248,0.6)]',
    chipSelf: 'bg-indigo-100 text-indigo-900',
    bigGlow: 'drop-shadow-[0_0_12px_rgba(129,140,248,0.7)]',
  },
  star: {
    label: '별',
    icon: '⭐',
    bgSoft: 'bg-violet-50',
    bgLit: 'bg-linear-to-br from-violet-100 to-fuchsia-200',
    textSoft: 'text-violet-800',
    textLit: 'text-violet-950',
    borderSoft: 'border-violet-200',
    borderLit: 'border-violet-400',
    ringLit: 'ring-violet-300',
    glowLit: 'shadow-[0_0_18px_rgba(167,139,250,0.55)]',
    haloLit: 'shadow-[0_0_24px_rgba(167,139,250,0.6)]',
    chipSelf: 'bg-violet-100 text-violet-900',
    bigGlow: 'drop-shadow-[0_0_12px_rgba(167,139,250,0.7)]',
  },
};

export const WIN_TYPE_LABELS: Record<NonNullable<SMS2WinType>, string> = {
  chips: '칩 우세',
  elimination: '상대 0칩',
  draw: '무승부',
  suddenDeath: '서든데스',
  timeout: '시간 초과',
  abandon: '기권',
};

export const PHASE_LABELS: Record<string, string> = {
  powder: '빛가루 분배',
  betFirst: '선 베팅',
  betSecond: '후 베팅',
  resolve: '정산',
  roundEnd: '라운드 결과',
  finished: '게임 종료',
};

export const PHASE_PILL_COLORS: Record<string, string> = {
  powder: 'bg-indigo-100 text-indigo-700',
  betFirst: 'bg-amber-100 text-amber-700',
  betSecond: 'bg-amber-100 text-amber-700',
  resolve: 'bg-violet-100 text-violet-700',
  roundEnd: 'bg-emerald-100 text-emerald-700',
  finished: 'bg-gray-100 text-gray-700',
};

export const POWDER_STAGE_LABELS: Record<number, string> = {
  1: '0~20',
  2: '21~40',
  3: '41~60',
  4: '61~80',
  5: '81~100',
};

/** 정산 스텝 간 간격 (ms) */
export const RESOLVE_STEP_INTERVAL_MS = 1300;
/** 정산 첫 스텝 표시 지연 (ms) */
export const RESOLVE_FIRST_DELAY_MS = 400;
