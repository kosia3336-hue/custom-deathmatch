'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';

export default function MemberSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  function go() {
    const params = new URLSearchParams();
    params.set('tab', 'members');
    if (q.trim()) params.set('q', q.trim());
    router.replace(`/admin?${params.toString()}`);
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="닉네임 검색..."
        />
      </div>
      <Button variant="secondary" onClick={go}>검색</Button>
    </div>
  );
}
