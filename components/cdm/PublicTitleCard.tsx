'use client';

import { Card } from './Card';
import { TitleBadge, type TitleEffect } from './TitleBadge';
import type { TitleColor } from '@/lib/supabase/database.types';

interface PublicTitleCardProps {
  name: string;
  color: TitleColor;
  effect?: string | null;
  description: string | null;
  holderCount: number;
  isSystem: boolean;
  isLegend?: boolean;
  /** 상점에서 현재 구매 가능한 칭호 */
  purchasable?: boolean;
  onClick: () => void;
}

/**
 * 공개 칭호 목록(`/titles`) 카드.
 * docs/v2/15_common_ui.md §15.9.6
 */
export function PublicTitleCard({
  name,
  color,
  effect,
  description,
  holderCount,
  isSystem,
  isLegend = false,
  purchasable = false,
  onClick,
}: PublicTitleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)] rounded-cdm-lg"
      aria-label={`${name} 상세 보기`}
    >
      <Card variant="interactive" className="p-4! h-full flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <TitleBadge name={name} color={color} effect={effect as TitleEffect | null} size="md" />
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isLegend && (
              <span
                className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-px text-[10px] font-bold text-amber-500 dark:text-amber-400"
                aria-label="레전드 칭호"
                title="레전드 칭호"
              >
                레전드
              </span>
            )}
            {purchasable && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-cdm-primary/40 bg-cdm-primary/10 px-2 py-px text-[10px] font-bold text-cdm-primary"
                aria-label="상점 칭호"
                title="상점 칭호"
              >
                상점
              </span>
            )}
            {isSystem && !isLegend && (
              <span
                className="inline-flex items-center rounded-full border border-cdm-border px-2 py-px text-[10px] font-semibold text-cdm-fg-muted"
                aria-label="히든 시스템 칭호"
                title="히든 시스템 칭호"
              >
                히든
              </span>
            )}
          </div>
        </div>
        {description && (
          <p className="text-sm text-cdm-fg-muted line-clamp-3">{description}</p>
        )}
        <p className="mt-auto pt-1 text-xs text-cdm-fg-subtle">
          보유자 {holderCount}명
        </p>
      </Card>
    </button>
  );
}
