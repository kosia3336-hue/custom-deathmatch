'use client';
import { cn } from '@/lib/utils';

export function ActionBtn({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'quatro-action-btn rounded-cdm-md px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
        variant === 'primary'
          ? 'border-cdm-primary bg-cdm-primary hover:bg-cdm-primary-strong border text-white'
          : 'border-cdm-primary bg-cdm-bg text-cdm-primary hover:bg-cdm-primary-soft border',
      )}
    >
      {children}
    </button>
  );
}
