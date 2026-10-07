import { type QuatroSuit } from '@/shared/types/quatro';
export const SUIT_INFO: Record<QuatroSuit, { symbol: string; cls: string; label: string }> = {
  spade: { symbol: '♠', cls: 'text-blue-600 border-blue-300 bg-blue-50', label: '스페이드' },
  diamond: { symbol: '♦', cls: 'text-yellow-600 border-yellow-300 bg-yellow-50', label: '다이아' },
  heart: { symbol: '♥', cls: 'text-red-600 border-red-300 bg-red-50', label: '하트' },
  club: { symbol: '♣', cls: 'text-green-600 border-green-300 bg-green-50', label: '클로버' },
  black: { symbol: '●', cls: 'text-white border-gray-700 bg-gray-900', label: '검정' },
};
