'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '미처리' },
  { value: 'done', label: '처리완료' },
] as const;

export type InquiryStatusFilter = (typeof FILTERS)[number]['value'];

export default function InquiriesFilterClient({
  current,
}: {
  current: InquiryStatusFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (value: InquiryStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('inquiryStatus', value);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-1">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => go(f.value)}
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
  );
}
