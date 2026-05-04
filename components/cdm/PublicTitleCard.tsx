'use client';

import { Card } from './Card';
import { TitleBadge } from './TitleBadge';
import type { TitleColor } from '@/lib/supabase/database.types';

interface PublicTitleCardProps {
  name: string;
  color: TitleColor;
  description: string | null;
  holderCount: number;
  isSystem: boolean;
  onClick: () => void;
}

/**
 * 공개 칭호 목록(`/titles`) 카드.
 * docs/v2/15_common_ui.md §15.9.6
 */
export function PublicTitleCard({
  name,
  color,
  description,
  holderCount,
  isSystem,
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
          <TitleBadge name={name} color={color} size="md" />
          {isSystem && (
            <span
              className="inline-flex items-center rounded-full border border-cdm-border px-2 py-px text-[10px] font-semibold text-cdm-fg-muted"
              aria-label="히든 시스템 칭호"
              title="히든 시스템 칭호"
            >
              히든
            </span>
          )}
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
