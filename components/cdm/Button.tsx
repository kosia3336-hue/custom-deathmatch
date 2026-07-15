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
  // 그래피티 무드: 청록(카지노 테이블) 채움 + 얇은 테두리 (그림자 없음)
  primary:
    'border border-cdm-primary bg-cdm-primary text-white hover:bg-cdm-primary-strong hover:border-cdm-primary-strong active:scale-[0.98]',
  secondary:
    'border border-cdm-primary bg-cdm-bg text-cdm-primary hover:bg-cdm-primary-soft active:scale-[0.98]',
  tertiary:
    'text-cdm-fg-muted hover:text-cdm-fg hover:bg-cdm-bg-elev-1 active:scale-[0.98]',
  danger:
    'border border-cdm-accent-strong bg-cdm-accent text-white hover:bg-cdm-accent-strong active:scale-[0.98]',
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
        'inline-flex items-center justify-center gap-2 rounded-cdm-md font-semibold whitespace-nowrap transition-all duration-(--cdm-duration-fast)',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cdm-fg',
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
