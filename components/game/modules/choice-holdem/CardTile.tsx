'use client';

import type { ChoiceHoldemCard } from '@/shared/types/choice-holdem';
import { cn } from '@/lib/utils';

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
          'rounded-cdm-md relative flex shrink-0 items-center justify-center overflow-hidden border-2 font-black shadow-sm transition',
          compact
            ? 'h-14 w-10 text-xl sm:h-16 sm:w-12 sm:text-2xl'
            : 'h-20 w-14 text-3xl sm:h-24 sm:w-17 sm:text-4xl',
          hidden
            ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
            : 'border-cdm-border-strong bg-cdm-bg text-cdm-fg',
          selected && 'border-cdm-highlight ring-cdm-highlight/30 ring-2',
          onClick &&
            'hover:border-cdm-highlight focus-visible:outline-cdm-highlight cursor-pointer hover:-translate-y-1 focus-visible:outline-2',
        )}
        aria-label={label ?? (hidden ? '뒷면 카드' : `${value} 카드`)}
      >
        {hidden ? (
          <span className="absolute inset-1.5 rounded-sm bg-[repeating-linear-gradient(135deg,currentColor_0_2px,transparent_2px_7px)] opacity-25" />
        ) : (
          <>
            <span className="absolute top-1 left-1.5 text-[10px] font-black sm:text-xs">
              {value}
            </span>
            <span>{value}</span>
            <span className="absolute right-1.5 bottom-1 rotate-180 text-[10px] font-black sm:text-xs">
              {value}
            </span>
          </>
        )}
      </Element>
      {label && (
        <span className="text-cdm-fg-muted max-w-24 truncate text-[10px] font-bold">{label}</span>
      )}
    </div>
  );
}
