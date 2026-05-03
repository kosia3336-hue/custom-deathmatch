'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** 모바일에서 가로 스크롤 (기본 true) */
  scrollable?: boolean;
}

/** 표준 탭. 활성 하단 2px primary. (15번 §15.7) */
export function Tabs({ tabs, value, onChange, className, scrollable = true }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex border-b border-cdm-border',
        scrollable && 'overflow-x-auto scrollbar-none',
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative shrink-0 px-4 py-3 text-sm font-medium transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              active ? 'text-cdm-fg font-semibold' : 'text-cdm-fg-muted hover:text-cdm-fg',
            )}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                  active
                    ? 'bg-cdm-primary text-white'
                    : 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
                )}
              >
                {t.count}
              </span>
            )}
            {active && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-[2px] w-full bg-cdm-primary"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
