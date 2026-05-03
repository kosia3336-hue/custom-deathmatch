import * as React from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'interactive' | 'highlight';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** 좌측 강조 막대 색 (highlight 일 때만) */
  accent?: 'primary' | 'accent' | 'highlight';
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'bg-cdm-bg-elev-1 border border-cdm-border',
  interactive:
    'bg-cdm-bg-elev-1 border border-cdm-border transition-all hover:shadow-[var(--cdm-shadow-sm)] hover:border-cdm-border-strong cursor-pointer',
  highlight: 'bg-cdm-bg-elev-1 border border-cdm-border relative overflow-hidden',
};

const ACCENT_CLASS = {
  primary: 'before:bg-cdm-primary',
  accent: 'before:bg-cdm-accent',
  highlight: 'before:bg-cdm-highlight',
};

export function Card({
  variant = 'default',
  accent = 'primary',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-cdm-lg p-4 sm:p-5',
        VARIANT_CLASS[variant],
        variant === 'highlight' &&
          cn(
            'before:absolute before:left-0 before:top-0 before:h-full before:w-1',
            ACCENT_CLASS[accent],
          ),
        className,
      )}
    >
      {children}
    </div>
  );
}
