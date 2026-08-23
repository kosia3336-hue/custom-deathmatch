'use client';

import { RankBadge } from '@/components/cdm/RankBadge';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { Card } from '@/components/cdm/Card';
import { GuildMark, type GuildMarkInfo } from '@/components/cdm/GuildMark';
import type { DisplayRankTier, RankTier } from '@/shared/types/rank';
import type { TitleColor } from '@/lib/supabase/database.types';

interface Props {
  rank: number;
  nickname: string;
  title?: { name: string; color: TitleColor; effect?: string | null } | null;
  tier: RankTier;
  rp: number;
  placementDone: boolean;
  wins: number;
  losses: number;
  draws: number;
  isChallenger: boolean;
  highlight: boolean;
  guildMark?: GuildMarkInfo | null;
}

export default function RankLeaderRow({
  rank,
  nickname,
  title,
  tier,
  rp,
  placementDone,
  wins,
  losses,
  draws,
  isChallenger,
  highlight,
  guildMark,
}: Props) {
  const displayTier: DisplayRankTier = isChallenger ? 'challenger' : tier;
  const placement = !placementDone;

  const total = wins + draws + losses;
  const winRatePct = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;

  return (
    <Card
      variant={highlight ? 'highlight' : 'default'}
      accent="primary"
      className="!p-3 flex flex-wrap items-center gap-3"
    >
      <span
        className={`w-10 text-center text-lg font-bold tabular-nums ${
          rank === 1 ? 'text-cdm-highlight' : rank <= 3 ? 'text-cdm-primary' : 'text-cdm-fg-muted'
        }`}
      >
        {rank}
      </span>
      <GuildMark mark={guildMark} size="xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-cdm-fg">{nickname}</p>
          {title ? <TitleBadge name={title.name} color={title.color} effect={title.effect as TitleEffect | null} size="sm" /> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <RankBadge
            tier={displayTier}
            rp={placement ? undefined : rp}
            size="lg"
            showRp={!placement}
          />
          <span className="text-xs text-cdm-fg-muted">
            {placement ? '배치전 · ' : ''}
            {total}전 {wins}승 {draws}무 {losses}패 · 승률 {winRatePct}%
          </span>
        </div>
      </div>
    </Card>
  );
}
