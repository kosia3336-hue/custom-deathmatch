'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-cdm-primary text-white hover:bg-cdm-primary-strong active:scale-[0.98]',
  secondary: 'border border-cdm-primary text-cdm-primary hover:bg-cdm-primary-soft active:scale-[0.98]',
  tertiary: 'text-cdm-primary hover:text-cdm-primary-strong hover:bg-cdm-primary-soft',
  danger: 'bg-cdm-accent text-white hover:bg-cdm-accent-strong active:scale-[0.98]',
  ghost: 'text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-4 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-cdm-md font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)]',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'opacity-40 cursor-not-allowed pointer-events-none',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  ),
);

Button.displayName = 'Button';
export default Button;
