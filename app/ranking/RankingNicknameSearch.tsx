'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/cdm/Icon';
import { cn } from '@/lib/utils';
import { RANKING_NICK_QUERY_MAX } from '@/lib/rank/nicknameSearch';

export default function RankingNicknameSearch({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [q, setQ] = useState(urlQ);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  const hiddenParams = Array.from(searchParams.entries()).filter(
    ([key]) => key !== 'q' && key !== 'page',
  );

  const clearHref = (() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('q');
    p.delete('page');
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const showClear = Boolean(q.trim() || urlQ);

  return (
    <form
      action={pathname}
      method="get"
      className={cn('min-w-[12rem] flex-1 md:w-60 md:flex-none', className)}
    >
      {hiddenParams.map(([key, value]) => (
        <input key={`${key}=${value}`} type="hidden" name={key} value={value} />
      ))}
      <div
        className={cn(
          'flex h-10 items-stretch rounded-cdm-md border bg-cdm-bg',
          'border-cdm-border focus-within:border-cdm-primary',
          'focus-within:[box-shadow:var(--cdm-ring-primary)]',
        )}
      >
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          aria-label="닉네임 검색"
          maxLength={RANKING_NICK_QUERY_MAX}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-cdm-fg placeholder:text-cdm-fg-subtle focus:outline-none"
        />
        {showClear ? (
          <a
            href={clearHref}
            className="inline-flex shrink-0 items-center px-1.5 text-cdm-fg-muted hover:text-cdm-fg"
            aria-label="검색 지우기"
          >
            <Icon name="close" size="sm" />
          </a>
        ) : null}
        <button
          type="submit"
          className="shrink-0 border-l border-cdm-border px-3 text-sm font-semibold text-cdm-primary hover:text-cdm-primary-strong"
        >
          검색
        </button>
      </div>
    </form>
  );
}
