'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import type { SortKey } from './MembersTab';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created_at', label: '최신순' },
  { value: 'games', label: '전적순' },
  { value: 'tier', label: '티어순' },
  { value: 'cdp', label: '포인트순' },
];

export default function MemberSearch({
  initial,
  sort: initialSort,
}: {
  initial: string;
  sort: SortKey;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [sort, setSort] = useState<SortKey>(initialSort);

  function go(overrideSort?: SortKey) {
    const params = new URLSearchParams();
    params.set('tab', 'members');
    if (q.trim()) params.set('q', q.trim());
    params.set('sort', overrideSort ?? sort);
    router.replace(`/admin?${params.toString()}`);
  }

  function handleSortChange(next: SortKey) {
    setSort(next);
    go(next);
  }

  return (
    <div className="flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="닉네임 검색..."
        />
      </div>
      <select
        value={sort}
        onChange={(e) => handleSortChange(e.target.value as SortKey)}
        className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 text-sm text-cdm-fg focus:outline-none focus:ring-2 focus:ring-cdm-primary/50"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button variant="secondary" onClick={() => go()}>검색</Button>
    </div>
  );
}
