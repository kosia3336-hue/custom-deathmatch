'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { InquiryCategoryRow } from '@/lib/inquiry/categories';
import {
  INQUIRY_STATUS_FILTERS,
  type InquiryCategoryFilter,
  type InquiryStatusFilter,
} from './inquiryFilters';
import InquiryCategoryManage from './InquiryCategoryManage';

const SELECT_CLASS =
  'h-[34px] rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2.5 text-sm text-cdm-fg outline-none focus:border-cdm-primary';

export default function InquiriesFilterClient({
  current,
  category,
  categories,
}: {
  current: InquiryStatusFilter;
  category: InquiryCategoryFilter;
  categories: InquiryCategoryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (next: { status?: InquiryStatusFilter; category?: InquiryCategoryFilter }) => {
    const params = new URLSearchParams(searchParams.toString());
    const status = next.status ?? current;
    const cat = next.category ?? category;
    if (status === 'all') params.delete('inquiryStatus');
    else params.set('inquiryStatus', status);
    if (cat === 'all') params.delete('inquiryCategory');
    else params.set('inquiryCategory', cat);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {INQUIRY_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => go({ status: f.value })}
            className={cn(
              'rounded-cdm-md px-3 py-1.5 text-sm font-medium transition-colors duration-(--cdm-duration-fast)',
              current === f.value
                ? 'bg-cdm-primary text-white'
                : 'bg-cdm-bg-elev-1 text-cdm-fg-muted hover:bg-cdm-bg-elev-2 hover:text-cdm-fg',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <select
        aria-label="문의 카테고리"
        value={category}
        onChange={(e) => go({ category: e.target.value as InquiryCategoryFilter })}
        className={SELECT_CLASS}
      >
        <option value="all">카테고리 전체</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.is_active ? c.label : `${c.label} (종료)`}
          </option>
        ))}
      </select>
      <InquiryCategoryManage categories={categories} />
    </div>
  );
}
