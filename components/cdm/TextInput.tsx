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
        <label htmlFor={inputId} className="text-sm font-medium text-cdm-fg">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        className={cn(
          'h-10 rounded-cdm-md border bg-cdm-bg px-3 text-sm text-cdm-fg placeholder:text-cdm-fg-subtle',
          'transition-colors focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
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
        <p id={`${inputId}-error`} className="text-xs text-cdm-accent">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-cdm-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
