'use client';

import { useEffect, useState } from 'react';
import { SongpyeonIcon } from '@/components/cdm/SongpyeonIcon';
import { formatCdp } from '@/lib/cdp/format';

export default function SongpyeonBalance({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance]);

  useEffect(() => {
    function onChange(event: Event) {
      const next = (event as CustomEvent<{ balance?: number }>).detail?.balance;
      if (typeof next === 'number') setBalance(next);
    }
    window.addEventListener('cdm:songpyeon', onChange);
    return () => window.removeEventListener('cdm:songpyeon', onChange);
  }, []);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-cdm-fg-muted">보유 송편</p>
      <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-cdm-fg sm:text-4xl">
        <SongpyeonIcon size={36} />
        <span className="tabular-nums">{formatCdp(balance)}</span>
      </p>
    </div>
  );
}
