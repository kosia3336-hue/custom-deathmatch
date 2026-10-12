'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  success?: boolean;
  fullWidth?: boolean;
}

/** 표준 텍스트 입력. (15번 §15.6.1) */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, success, fullWidth = true, className, id, ...rest },
  ref,
) {
  const reactId = React.useId();
  const inputId = id ?? `tin-${reactId}`;

  return (
    <div className={cn('flex flex-col gap-1', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={inputId} className="text-cdm-fg text-sm font-medium">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          // iPhone 입력 포커스 자동 확대를 피하도록 루트 크기와 무관하게 16px을 유지한다.
          'rounded-cdm-md bg-cdm-bg text-cdm-fg placeholder:text-cdm-fg-subtle h-10 border px-3 text-[16px]',
          'transition-colors focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-cdm-accent focus:border-cdm-accent'
            : success
              ? 'border-cdm-success focus:border-cdm-success'
              : 'border-cdm-border focus:border-cdm-primary',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-cdm-accent text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-cdm-fg-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
