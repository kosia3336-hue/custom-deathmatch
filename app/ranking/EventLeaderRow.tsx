'use client';

import { Card } from '@/components/cdm/Card';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import type { TitleColor } from '@/lib/supabase/database.types';

interface Props {
  rank: number;
  nickname: string;
  title?: { name: string; color: TitleColor; effect?: string | null } | null;
  totalScore: number;
  roundsPlayed: number;
  roundsWon: number;
  highlight: boolean;
}

export default function EventLeaderRow({
  rank,
  nickname,
  title,
  totalScore,
  roundsPlayed,
  roundsWon,
  highlight,
}: Props) {
  return (
    <Card
      variant={highlight ? 'highlight' : 'default'}
      accent="primary"
      className="!p-3 flex items-center gap-3"
    >
      <span
        className={`w-10 text-center text-lg font-bold tabular-nums ${
          rank === 1 ? 'text-cdm-highlight' : rank <= 3 ? 'text-cdm-primary' : 'text-cdm-fg-muted'
        }`}
      >
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {title && (
            <TitleBadge name={title.name} color={title.color} effect={title.effect as 'legend' | null} size="sm" />
          )}
          <span className="truncate font-semibold text-cdm-fg">
            {nickname}
            {highlight && <span className="ml-1 text-xs text-cdm-fg-muted">(나)</span>}
          </span>
        </div>
        <p className="text-xs text-cdm-fg-muted">
          {roundsPlayed}판 · {roundsWon}회 득점
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tabular-nums text-amber-600">{totalScore}</p>
        <p className="text-[10px] text-cdm-fg-muted">누적</p>
      </div>
    </Card>
  );
}
