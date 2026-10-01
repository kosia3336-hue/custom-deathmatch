'use client';

import type { ChoiceHoldemCard } from '@/shared/types/choice-holdem';
import { PlayingCard } from '@/components/game/cards';
import { cn } from '@/lib/utils';

/*
  카드 그림은 공용 숫자 카드(PlayingCard)를 쓴다 — 양면포커·인디언홀덤Q 와 같은 덱.
  이 파일은 고르는 단추(선택 테두리·들어 올림)와 아래 이름표만 맡는다.
*/
export default function CardTile({
  value,
  label,
  selected = false,
  compact = false,
  onClick,
}: {
  value: ChoiceHoldemCard | null;
  label?: string;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const hidden = value == null;
  const Element = onClick ? 'button' : 'div';
  return (
    <div className="flex flex-col items-center gap-1">
      <Element
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'rounded-cdm-md relative flex shrink-0 transition',
          selected && 'ring-cdm-highlight ring-2 ring-offset-1',
          onClick &&
            'focus-visible:outline-cdm-highlight cursor-pointer hover:-translate-y-1 focus-visible:outline-2',
        )}
        aria-label={label ?? (hidden ? '뒷면 카드' : `${value} 카드`)}
      >
        <PlayingCard
          value={value}
          hidden={hidden}
          decorative
          className={compact ? 'w-10 sm:w-12' : 'w-14 sm:w-17'}
        />
      </Element>
      {label && (
        <span className="text-cdm-fg-muted max-w-24 truncate text-[10px] font-bold">{label}</span>
      )}
    </div>
  );
}
