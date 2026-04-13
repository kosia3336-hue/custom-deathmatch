import type { IDWinType } from '@/shared/types/invest-donate';

export const WIN_TYPE_LABELS: Record<IDWinType, string> = {
  elimination: '승점 탈락',
  score: '승점 승리',
  tiebreaker: '코인 타이브레이커',
  timeout: '시간 초과',
  leave: '상대 이탈',
};

export const COIN_DENOMINATIONS = [
  { key: 'coin50' as const, label: '50', value: 50, color: 'bg-amber-400 border-amber-500 text-amber-900' },
  { key: 'coin10' as const, label: '10', value: 10, color: 'bg-slate-300 border-slate-400 text-slate-800' },
  { key: 'coin1' as const, label: '1', value: 1, color: 'bg-orange-300 border-orange-400 text-orange-900' },
] as const;
