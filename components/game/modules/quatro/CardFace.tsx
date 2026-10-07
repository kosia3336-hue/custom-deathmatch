'use client';
import { cn } from '@/lib/utils';
import { type QuatroCard } from '@/shared/types/quatro';
import { SUIT_INFO } from './presentation';
import FourCardCard from './skins/FourCardCard';

export function CardFace({
  card,
  size = 'md',
  selected,
  dimmed,
  onClick,
  badge,
  fourCard,
}: {
  card: QuatroCard | null;
  size?: 'sm' | 'md';
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  badge?: string;
  fourCard?: boolean;
}) {
  if (fourCard) {
    return (
      <FourCardCard
        card={card}
        size={size}
        selected={selected}
        dimmed={dimmed}
        onClick={onClick}
        badge={badge}
      />
    );
  }

  const sz =
    size === 'sm'
      ? 'h-[clamp(22px,6cqh,44px)] aspect-[3/4] text-sm'
      : 'h-[clamp(36px,9cqh,64px)] aspect-[3/4] text-lg';
  if (!card) {
    return (
      <div
        className={cn(
          sz,
          'flex items-center justify-center rounded-md border-2 border-indigo-300 bg-indigo-500/80 text-white shadow-sm',
        )}
        aria-label="뒷면 카드"
      >
        <span className="text-xs opacity-70">?</span>
      </div>
    );
  }
  const info = SUIT_INFO[card.suit];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        sz,
        'relative flex flex-col items-center justify-center rounded-md border-2 font-bold shadow-sm transition-all',
        info.cls,
        selected && 'ring-cdm-primary -translate-y-1 ring-2',
        dimmed && 'opacity-45',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
      )}
      aria-label={`${info.label} ${card.num}`}
    >
      <span className="leading-none">{info.symbol}</span>
      <span className="leading-none">{card.num}</span>
      {badge && (
        <span className="bg-cdm-fg absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[11px] leading-4 font-bold whitespace-nowrap text-white">
          {badge}
        </span>
      )}
    </Comp>
  );
}
