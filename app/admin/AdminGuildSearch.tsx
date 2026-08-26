'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';

type StatusFilter = 'active' | 'disbanded' | 'all';

export default function AdminGuildSearch({
  initial,
  status,
}: {
  initial: string;
  status: StatusFilter;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [st, setSt] = useState<StatusFilter>(status);

  function go(nextStatus?: StatusFilter) {
    const params = new URLSearchParams();
    params.set('tab', 'guilds');
    if (q.trim()) params.set('q', q.trim());
    params.set('guildStatus', nextStatus ?? st);
    router.replace(`/admin?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[160px] flex-1">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="길드명 검색..."
        />
      </div>
      <select
        value={st}
        onChange={(e) => {
          const next = e.target.value as StatusFilter;
          setSt(next);
          go(next);
        }}
        className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 text-sm text-cdm-fg focus:outline-none focus:ring-2 focus:ring-cdm-primary/50"
      >
        <option value="active">활성</option>
        <option value="disbanded">해체</option>
        <option value="all">전체</option>
      </select>
      <Button variant="secondary" onClick={() => go()}>
        검색
      </Button>
    </div>
  );
}
