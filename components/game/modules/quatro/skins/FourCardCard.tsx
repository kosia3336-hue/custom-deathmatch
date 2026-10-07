import { cn } from '@/lib/utils';
import type { QuatroCard, QuatroSuit } from '@/shared/types/quatro';
import type { CSSProperties } from 'react';

const SUIT_INFO: Record<QuatroSuit, { symbol: string; label: string }> = {
  spade: { symbol: '♠', label: '스페이드' },
  diamond: { symbol: '♦', label: '다이아' },
  heart: { symbol: '♥', label: '하트' },
  club: { symbol: '♣', label: '클로버' },
  black: { symbol: '✦', label: '조커' },
};

interface FourCardCardProps {
  card: QuatroCard | null;
  size?: 'sm' | 'md';
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  badge?: string;
}

/** 포카드 스킨 전용 트럼프 카드. 숫자·문양은 DOM, 삽화와 뒷면만 래스터 에셋을 쓴다. */
export default function FourCardCard({
  card,
  size = 'md',
  selected,
  dimmed,
  onClick,
  badge,
}: FourCardCardProps) {
  const fit: CSSProperties = {
    height: size === 'sm' ? 'clamp(26px, 7cqh, 48px)' : 'clamp(42px, 10cqh, 64px)',
    width: 'auto',
    aspectRatio: '3/4',
    fontSize: '11px',
  };
  const sizeClass = `skin-four-card-card--${size}`;

  if (!card) {
    return (
      <div
        className={cn('skin-four-card-card skin-four-card-card--back', sizeClass)}
        style={fit}
        aria-label="뒷면 카드"
      />
    );
  }

  const info = SUIT_INFO[card.suit];
  const isJoker = card.suit === 'black';
  const className = cn(
    'skin-four-card-card skin-four-card-card--face',
    `skin-four-card-card--${card.suit}`,
    sizeClass,
    selected && 'skin-four-card-card--selected',
    dimmed && 'skin-four-card-card--dimmed',
    onClick && 'skin-four-card-card--clickable',
  );

  const content = (
    <>
      <span className="skin-four-card-corner skin-four-card-corner--top">
        <span>{card.num}</span>
        <span aria-hidden>{info.symbol}</span>
      </span>
      {isJoker ? (
        <span className="skin-four-card-joker" aria-hidden />
      ) : (
        <span className="skin-four-card-suit" aria-hidden>
          {info.symbol}
        </span>
      )}
      <span className="skin-four-card-corner skin-four-card-corner--bottom" aria-hidden>
        <span>{card.num}</span>
        <span>{info.symbol}</span>
      </span>
      {badge && <span className="skin-four-card-badge">{badge}</span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={fit}
        className={className}
        aria-label={`${info.label} ${card.num}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div style={fit} className={className} aria-label={`${info.label} ${card.num}`}>
      {content}
    </div>
  );
}
