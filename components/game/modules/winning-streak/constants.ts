import type { WSCardType } from '@/shared/types/winning-streak';

export interface CardMatchupInfo {
  beats: string;
  losesTo: string;
  special?: string;
}

export const CARD_MATCHUP_DESC: Record<WSCardType, CardMatchupInfo> = {
  spade: {
    beats: '♥ 하트, 흑백조커',
    losesTo: '♦ 다이아몬드, ♣ 클로버, 컬러조커',
    special: '같은 ♠끼리는 양측 패배',
  },
  diamond: {
    beats: '♠ 스페이드, ♣ 클로버, 흑백조커',
    losesTo: '♥ 하트, 컬러조커',
    special: '같은 ♦끼리는 양측 패배',
  },
  heart: {
    beats: '♦ 다이아몬드, 흑백조커',
    losesTo: '♠ 스페이드, ♣ 클로버, 컬러조커',
    special: '같은 ♥끼리는 양측 패배',
  },
  club: {
    beats: '♠ 스페이드, ♥ 하트, 흑백조커',
    losesTo: '♦ 다이아몬드, 컬러조커',
    special: '같은 ♣끼리는 양측 패배',
  },
  blackJoker: {
    beats: '없음 (항상 집니다)',
    losesTo: '모든 카드',
    special: '흑백조커끼리는 양측 패배 — 연속 제한 회피 용도',
  },
  colorJoker: {
    beats: '모든 카드 (항상 이깁니다)',
    losesTo: '없음',
    special: '컬러조커끼리는 양측 승리 — 둘 다 연승 +1',
  },
};

export const WIN_TYPE_LABELS: Record<string, string> = {
  streak: '최대 연승',
  wins: '총 승리 수',
  draw: '무승부',
  timeout: '시간 초과',
  abandon: '기권',
};

export const CARD_LABELS: Record<WSCardType, string> = {
  spade: '♠',
  diamond: '♦',
  heart: '♥',
  club: '♣',
  blackJoker: '🃏',
  colorJoker: '🃏',
};

export const CARD_NAMES: Record<WSCardType, string> = {
  spade: '스페이드',
  diamond: '다이아몬드',
  heart: '하트',
  club: '클로버',
  blackJoker: '흑백조커',
  colorJoker: '컬러조커',
};

export const CARD_COLORS: Record<WSCardType, { bg: string; text: string; border: string; icon: string }> = {
  spade: {
    bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-700',
    icon: '♠',
  },
  diamond: {
    bg: 'bg-red-500', text: 'text-white', border: 'border-red-600',
    icon: '♦',
  },
  heart: {
    bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600',
    icon: '♥',
  },
  club: {
    bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-700',
    icon: '♣',
  },
  blackJoker: {
    bg: 'bg-gray-400', text: 'text-gray-800', border: 'border-gray-500',
    icon: '🃏',
  },
  colorJoker: {
    bg: 'bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400',
    text: 'text-white', border: 'border-purple-400',
    icon: '🃏',
  },
};
