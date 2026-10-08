'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/cdm/Button';
import { formulaTileUsage } from '@/lib/formulaTileUsage';
import { cn } from '@/lib/utils';
import styles from './formula-completion.module.css';

interface Props {
  numbers: number[];
  expression: string;
  onExpressionChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  className?: string;
}

const MOBILE_QUERY = '(max-width: 1023px)';
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const getMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerSnapshot = () => false;

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
  const padRef = useRef<HTMLDivElement>(null);
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerSnapshot);
  const [nativeInput, setNativeInput] = useState(false);
  const compactInput = isMobile && nativeInput;
  const [preferredIndices, setPreferredIndices] = useState<number[]>([]);
  const { usedIndices, invalidNumbers } = formulaTileUsage(expression, numbers, preferredIndices);

  useEffect(() => {
    // 모바일은 카드 키패드를 기본으로 사용한다. 자동 포커스로 키보드를 열지 않는다.
    if (disabled || window.matchMedia(MOBILE_QUERY).matches) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [disabled]);

  useEffect(() => {
    if (!compactInput) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const keepInputVisible = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // 키보드 높이가 바뀐 뒤 입력란과 제출 버튼이 함께 보이도록 실제 스크롤한다.
        padRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      });
    };
    keepInputVisible();
    viewport?.addEventListener('resize', keepInputVisible);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', keepInputVisible);
    };
  }, [compactInput]);

  const append = (value: string) => {
    if (disabled) return;
    onExpressionChange(`${expression}${value}`.slice(0, 160));
    if (!isMobile) inputRef.current?.focus({ preventScroll: true });
  };

  const toggleKeyboard = () => {
    if (nativeInput) {
      inputRef.current?.blur();
      setNativeInput(false);
    } else {
      // iOS는 사용자 클릭 안에서 focus해야 키보드를 연다. readOnly 해제부터 반영한다.
      flushSync(() => setNativeInput(true));
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={padRef} className={cn(styles.pad, className)}>
      <div className={styles.tileRow} aria-label="제시 숫자">
        {numbers.map((number, index) => {
          const used = usedIndices.includes(index);
          return (
            <button
              key={`${number}-${index}`}
              type="button"
              onClick={() => {
                if (disabled || used) return;
                setPreferredIndices([...usedIndices, index]);
                append(String(number));
              }}
              disabled={disabled || used}
              className={cn(styles.tile, styles.numberTile, used && styles.usedTile)}
              aria-label={`숫자 ${number} 입력${used ? ' (사용됨)' : ''}`}
            >
              {number}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <label
          className="text-cdm-fg-muted text-xs font-semibold"
          htmlFor="formula-completion-input"
        >
          수식 입력
        </label>
        {isMobile && (
          <Button
            variant="tertiary"
            size="sm"
            className="h-11 px-3"
            onClick={toggleKeyboard}
            disabled={disabled}
            aria-pressed={nativeInput}
          >
            {nativeInput ? '카드 키패드' : '키보드 입력'}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        id="formula-completion-input"
        value={expression}
        onChange={(event) => onExpressionChange(cleanInput(event.target.value))}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing &&
            invalidNumbers.length === 0
          ) {
            event.preventDefault();
            onSubmit();
          }
        }}
        readOnly={isMobile && !nativeInput}
        disabled={disabled}
        inputMode={isMobile && !nativeInput ? 'none' : 'text'}
        autoComplete="off"
        spellCheck={false}
        placeholder="예: 4*6+7-5"
        className="rounded-cdm-md border-cdm-border bg-cdm-bg text-cdm-fg focus:border-cdm-primary disabled:bg-cdm-bg-elev-1 disabled:text-cdm-fg-muted h-14 w-full border-2 px-3 text-center font-mono text-xl font-bold tracking-wide transition-colors outline-none"
      />

      {!compactInput && (
        <div className={styles.tileRow} aria-label="연산자와 괄호">
          {OPERATORS.map((operator) => (
            <button
              key={operator.value}
              type="button"
              onClick={() => append(operator.value)}
              disabled={disabled}
              className={styles.tile}
            >
              {operator.label}
            </button>
          ))}
        </div>
      )}
      {invalidNumbers.length > 0 && (
        <p role="status" className="text-cdm-accent text-xs">
          제시된 숫자를 각 타일당 한 번만 사용해 주세요.
        </p>
      )}

      <div className="grid grid-cols-[auto_auto_1fr] gap-2">
        <Button
          variant="tertiary"
          className="h-11 px-3"
          onClick={() => onExpressionChange(expression.slice(0, -1))}
          disabled={disabled || !expression}
          aria-label="마지막 글자 지우기"
        >
          지우기
        </Button>
        <Button
          variant="tertiary"
          className="h-11 px-3"
          onClick={() => {
            onExpressionChange('');
            setPreferredIndices([]);
          }}
          disabled={disabled || !expression}
        >
          초기화
        </Button>
        <Button
          fullWidth
          className="h-11 px-3"
          onClick={onSubmit}
          disabled={disabled || !expression.trim() || invalidNumbers.length > 0}
        >
          수식 외치기
        </Button>
      </div>
    </div>
  );
}
