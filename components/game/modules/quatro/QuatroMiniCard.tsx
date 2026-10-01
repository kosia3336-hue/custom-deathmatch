import type { QuatroCard, QuatroSuit } from '@/shared/types/quatro';
import { cn } from '@/lib/utils';

const SUIT_INFO: Record<QuatroSuit, { symbol: string; cls: string; label: string }> = {
  spade: { symbol: '♠', cls: 'text-blue-600 border-blue-300 bg-blue-50', label: '스페이드' },
  diamond: { symbol: '♦', cls: 'text-yellow-600 border-yellow-300 bg-yellow-50', label: '다이아' },
  heart: { symbol: '♥', cls: 'text-red-600 border-red-300 bg-red-50', label: '하트' },
  club: { symbol: '♣', cls: 'text-green-600 border-green-300 bg-green-50', label: '클로버' },
  black: { symbol: '●', cls: 'text-white border-gray-700 bg-gray-900', label: '검정' },
};

/** 기록용 작은 카드 — 인게임 메모 '기록'과 게임 기록 뷰어가 함께 쓴다. card=null 이면 뒷면(비공개). */
export default function QuatroMiniCard({ card, dimmed }: { card: QuatroCard | null; dimmed?: boolean }) {
  if (!card) {
    return (
      <span
        aria-label="비공개 카드"
        className="inline-flex h-9 w-7 items-center justify-center rounded border border-indigo-300 bg-indigo-500/80 text-[11px] font-bold text-white"
      >
        ?
      </span>
    );
  }
  const info = SUIT_INFO[card.suit];
  return (
    <span
      aria-label={`${info.label} ${card.num}`}
      className={cn(
        'inline-flex h-9 w-7 flex-col items-center justify-center rounded border text-[11px] font-bold leading-none',
        info.cls,
        dimmed && 'opacity-50',
      )}
    >
      <span>{info.symbol}</span>
      <span>{card.num}</span>
    </span>
  );
}
