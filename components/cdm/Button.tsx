'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost' | 'kakao';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-cdm-primary text-white hover:bg-cdm-primary-strong active:scale-[0.98] focus-visible:[box-shadow:var(--cdm-ring-primary)]',
  secondary:
    'border border-cdm-border-strong bg-cdm-bg text-cdm-fg hover:bg-cdm-bg-elev-1 active:scale-[0.98]',
  tertiary:
    'text-cdm-fg-muted hover:text-cdm-fg hover:bg-cdm-bg-elev-1 active:scale-[0.98]',
  danger:
    'bg-cdm-accent text-white hover:bg-cdm-accent-strong active:scale-[0.98] focus-visible:[box-shadow:var(--cdm-ring-accent)]',
  ghost: 'text-cdm-fg hover:bg-cdm-bg-elev-1 active:scale-[0.98]',
  kakao:
    'bg-[#FEE500] text-[#000000] hover:brightness-95 active:scale-[0.98] font-semibold',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-7 text-base',
};

/** v2 표준 버튼 — docs/v2/15_common_ui.md §15.2 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    leftIcon,
    rightIcon,
    disabled,
    children,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      data-loading={loading ? 'true' : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-cdm-md font-semibold transition-colors duration-(--cdm-duration-fast)',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
