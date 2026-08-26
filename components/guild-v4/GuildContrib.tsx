'use client';

import { useMemo, useState } from 'react';
import { Tabs } from '@/components/cdm/Tabs';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { MyGuildState } from '@/lib/guild/types';
import type { DevGuildContribPeriod } from './dummy';
import { formatGuildRankScore } from './rankScore';
import { useGuildDevStore } from './store';

const PERIOD_TABS = [
  { id: 'daily', label: '일간' },
  { id: 'weekly', label: '주간' },
  { id: 'all', label: '전체' },
] as const;

function formatContribScore(n: number) {
  return `${formatGuildRankScore(n)}점`;
}

export function GuildContribSection({
  my,
  myMemberId,
}: {
  my: MyGuildState;
  myMemberId: string;
}) {
  const contribs = useGuildDevStore((s) => s.contribs);
  const titles = useGuildDevStore((s) => s.titles);
  const [period, setPeriod] = useState<string>('daily');
  const key = (PERIOD_TABS.some((t) => t.id === period) ? period : 'daily') as DevGuildContribPeriod;

  const rows = useMemo(() => {
    return [...my.members]
      .map((m) => ({
        memberId: m.memberId,
        nickname: m.nickname,
        score: contribs[m.memberId]?.[key] ?? 0,
        title: titles[m.memberId] ?? null,
      }))
      .filter((m) => Math.round(m.score) > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.nickname.localeCompare(b.nickname, 'ko');
      });
  }, [my.members, contribs, titles, key]);

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={[...PERIOD_TABS]} value={key} onChange={setPeriod} />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-cdm-fg-muted">이 기간에 획득한 점수가 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {rows.map((m, i) => {
            const rank = i + 1;
            const isMe = m.memberId === myMemberId;
            const title = m.title;
            return (
              <li
                key={m.memberId}
                className={`flex items-center gap-3 rounded-cdm-md px-2 py-1.5 text-sm ${
                  isMe ? 'bg-cdm-primary-soft' : ''
                }`}
              >
                <span
                  className={`w-6 shrink-0 text-center text-xs font-bold tabular-nums ${
                    rank === 1 ? 'text-cdm-highlight-strong' : 'text-cdm-fg-muted'
                  }`}
                >
                  {rank}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium text-cdm-fg">
                    {m.nickname}
                    {isMe ? (
                      <span className="ml-1 text-[11px] font-normal text-cdm-fg-subtle">(나)</span>
                    ) : null}
                  </span>
                  {title ? (
                    <TitleBadge
                      name={title.name}
                      color={title.color as TitleColor}
                      effect={title.effect as TitleEffect | null}
                      size="sm"
                    />
                  ) : null}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-cdm-fg">
                  {formatContribScore(m.score)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
