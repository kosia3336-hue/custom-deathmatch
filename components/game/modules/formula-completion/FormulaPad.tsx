'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/cdm/Button';
import { cn } from '@/lib/utils';

interface Props {
  numbers: number[];
  expression: string;
  onExpressionChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  className?: string;
}

const OPERATORS = [
  { label: '+', value: '+' },
  { label: '−', value: '-' },
  { label: '×', value: '*' },
  { label: '÷', value: '/' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
] as const;

function cleanInput(value: string): string {
  return value.replace(/[^\d+\-*/()×÷xX−–—\s]/g, '').slice(0, 160);
}

export default function FormulaPad({
  numbers,
  expression,
  onExpressionChange,
  onSubmit,
  disabled = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const numberGridClass = numbers.length === 4
    ? 'grid-cols-4'
    : numbers.length === 5
      ? 'grid-cols-5'
      : 'grid-cols-6';

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (disabled) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled]);

  const append = (value: string) => {
    if (disabled) return;
    onExpressionChange(`${expression}${value}`.slice(0, 160));
    focusInput();
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <label className="sr-only" htmlFor="formula-completion-input">수식 입력</label>
      <input
        ref={inputRef}
        id="formula-completion-input"
        autoFocus
        value={expression}
        onChange={(event) => onExpressionChange(cleanInput(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        disabled={disabled}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="예: 4*6+7-5"
        className="h-14 w-full rounded-cdm-md border-2 border-cdm-border bg-cdm-bg px-4 text-center font-mono text-xl font-bold tracking-wide text-cdm-fg outline-none transition-colors focus:border-cdm-primary disabled:bg-cdm-bg-elev-1 disabled:text-cdm-fg-muted"
      />

      <div className={cn('grid gap-2', numberGridClass)} aria-label="제시 숫자">
        {numbers.map((number, index) => (
          <button
            key={`${number}-${index}`}
            type="button"
            onClick={() => append(String(number))}
            disabled={disabled}
            className="h-11 rounded-cdm-md border border-cdm-border-strong bg-cdm-bg text-lg font-extrabold text-cdm-fg transition-colors hover:border-cdm-primary hover:bg-cdm-primary-soft disabled:opacity-40"
            aria-label={`숫자 ${number} 입력`}
          >
            {number}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-2" aria-label="연산자와 괄호">
        {OPERATORS.map((operator) => (
          <button
            key={operator.value}
            type="button"
            onClick={() => append(operator.value)}
            disabled={disabled}
            className="h-10 rounded-cdm-md bg-cdm-bg-elev-2 text-base font-bold text-cdm-fg-muted transition-colors hover:bg-cdm-primary-soft hover:text-cdm-primary disabled:opacity-40"
          >
            {operator.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_auto_1fr] gap-2">
        <Button
          variant="tertiary"
          onClick={() => {
            onExpressionChange(expression.slice(0, -1));
            focusInput();
          }}
          disabled={disabled || !expression}
          aria-label="마지막 글자 지우기"
        >
          지우기
        </Button>
        <Button
          variant="tertiary"
          onClick={() => {
            onExpressionChange('');
            focusInput();
          }}
          disabled={disabled || !expression}
        >
          초기화
        </Button>
        <Button
          fullWidth
          onClick={onSubmit}
          disabled={disabled || !expression.trim()}
        >
          수식 외치기
        </Button>
      </div>
    </div>
  );
}
