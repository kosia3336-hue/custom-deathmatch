'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-cdm-fg text-sm font-medium">{label}</label>}
      <input
        ref={ref}
        className={cn(
          // rem 기반 기본 글꼴은 모바일에서 15px이므로 입력 글자는 px 단위로 지정한다.
          'rounded-cdm-md bg-cdm-bg text-cdm-fg placeholder:text-cdm-fg-subtle h-10 border px-3 text-[16px] transition-colors outline-none',
          error
            ? 'border-cdm-accent focus:border-cdm-accent focus:[box-shadow:var(--cdm-ring-accent)]'
            : 'border-cdm-border focus:border-cdm-primary focus:[box-shadow:var(--cdm-ring-primary)]',
          className,
        )}
        {...props}
      />
      {error && <p className="text-cdm-accent text-xs">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
export default Input;
