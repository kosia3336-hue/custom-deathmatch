'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-cdm-fg">{label}</label>}
    <input
      ref={ref}
      className={cn(
        'h-10 rounded-cdm-md border bg-cdm-bg px-3 text-sm text-cdm-fg outline-none transition-colors placeholder:text-cdm-fg-subtle',
        error
          ? 'border-cdm-accent focus:border-cdm-accent focus:[box-shadow:var(--cdm-ring-accent)]'
          : 'border-cdm-border focus:border-cdm-primary focus:[box-shadow:var(--cdm-ring-primary)]',
        className,
      )}
      {...props}
    />
    {error && <p className="text-xs text-cdm-accent">{error}</p>}
  </div>
));

Input.displayName = 'Input';
export default Input;
