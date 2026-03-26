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
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]',
  secondary: 'border border-indigo-600 text-indigo-600 hover:bg-indigo-50 active:scale-[0.98]',
  tertiary: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]',
  ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
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
