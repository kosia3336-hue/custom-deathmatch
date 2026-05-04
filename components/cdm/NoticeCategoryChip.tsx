import { cn } from '@/lib/utils';
import type { NoticeCategory } from '@/lib/supabase/database.types';

type ChipSize = 'sm' | 'md';

interface NoticeCategoryChipProps {
  category: NoticeCategory;
  size?: ChipSize;
  className?: string;
}

/**
 * 공지사항 카테고리 칩 — docs/v2/15_common_ui.md §15.8.4, docs/v2/20_notices.md §20.3
 *
 * 색은 디자인 토큰 재사용. 색맹 대응을 위해 **색 + 라벨** 동시 노출.
 */
const CATEGORY: Record<NoticeCategory, { label: string; tone: string }> = {
  general:     { label: '일반',   tone: 'bg-cdm-bg-elev-2 text-cdm-fg-muted' },
  maintenance: { label: '점검',   tone: 'bg-cdm-highlight-soft text-[#a16207]' },
  update:      { label: '업데이트', tone: 'bg-cdm-info-soft text-[#1d4ed8]' },
  event:       { label: '이벤트', tone: 'bg-cdm-accent-soft text-[#be123c]' },
  urgent:      { label: '긴급',   tone: 'bg-cdm-accent text-white' },
};

const SIZE: Record<ChipSize, string> = {
  sm: 'px-2 py-[3px] text-[11px]',
  md: 'px-2.5 py-[3px] text-[12px]',
};

export function NoticeCategoryChip({
  category,
  size = 'sm',
  className,
}: NoticeCategoryChipProps) {
  const { label, tone } = CATEGORY[category];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap',
        tone,
        SIZE[size],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** 카테고리 한글 라벨만 추출 (메타 태그/접근성 라벨 등에서 사용) */
export function getNoticeCategoryLabel(category: NoticeCategory): string {
  return CATEGORY[category].label;
}

/** 사용자 측 필터 칩에서 사용할 카테고리 순서 */
export const NOTICE_CATEGORIES: NoticeCategory[] = [
  'general',
  'maintenance',
  'update',
  'event',
  'urgent',
];
