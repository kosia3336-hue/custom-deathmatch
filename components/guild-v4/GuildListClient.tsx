'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Tabs } from '@/components/cdm/Tabs';
import { RankCardShell } from '@/components/ranking/RankCardShell';
import {
  GUILD_CHARTER_PRICE_CDP,
  type GuildSummary,
  type MyGuildState,
} from '@/lib/guild/types';
import type { RankCardShopSkinId } from '@shared/rank-card-skins';
import { useGuildDevApi } from './useGuildDevApi';
import { CreateGuildModal } from './CreateGuildModal';
import { GuildBackLink } from './GuildBackLink';
import { GuildInfoModal } from './GuildInfoModal';
import type { DevGuildMe } from './dummy';
import {
  assignGuildRanks,
  formatGuildRankScore,
  type DevGuildRankPeriod,
} from './rankScore';
import { useGuildDevStore } from './store';

const RANK_TABS = [
  { id: 'weekly', label: '주간' },
  { id: 'monthly', label: '월간' },
] as const;

type RankTab = (typeof RANK_TABS)[number]['id'];

type Act = (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;

export function GuildListPanel({
  guilds,
  my,
  busy,
  act,
  variant = 'page',
}: {
  guilds: GuildSummary[];
  my: MyGuildState;
  busy: boolean;
  act: Act;
  variant?: 'page' | 'modal';
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [infoGuild, setInfoGuild] = useState<GuildSummary | null>(null);
  const canApply = !my.guild && !my.myRequest;
  const page = variant === 'page';
  const rankScores = useGuildDevStore((s) => s.rankScores);
  const rankCards = useGuildDevStore((s) => s.rankCards);
  const [tab, setTab] = useState<string>('weekly');
  const key = (RANK_TABS.some((t) => t.id === tab) ? tab : 'weekly') as RankTab;
  const period = key as DevGuildRankPeriod;
  const ranked = useMemo(() => {
    const periodScores: Record<string, number> = {};
    for (const g of guilds) {
      periodScores[g.id] = rankScores[g.id]?.[period] ?? 0;
    }
    const ranks = assignGuildRanks(guilds, periodScores);
    return [...guilds]
      .sort((a, b) => {
        const ra = ranks.get(a.id) ?? 0;
        const rb = ranks.get(b.id) ?? 0;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name, 'ko');
      })
      .map((g) => ({
        guild: g,
        rank: ranks.get(g.id) ?? 0,
        score: periodScores[g.id] ?? 0,
      }));
  }, [guilds, rankScores, period]);

  return (
    <>
      {page && (
        <header className="flex items-center justify-between">
          <div>
            {my.guild && <GuildBackLink />}
            <h1 className={`${my.guild ? 'mt-2 ' : ''}text-xl font-bold text-cdm-fg`}>랭킹</h1>
          </div>
          {!my.guild && (
            <Button
              onClick={() => {
                if (my.charterCount <= 0) {
                  toast(
                    `길드 창설권이 필요합니다. 상점에서 ${GUILD_CHARTER_PRICE_CDP.toLocaleString()} CDP에 구매할 수 있습니다.`,
                  );
                  return;
                }
                setCreateOpen(true);
              }}
              disabled={busy}
            >
              길드 창설
            </Button>
          )}
        </header>
      )}

      {my.myRequest && !my.guild && (
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm text-cdm-fg">
            <strong>{my.myRequest.guildName}</strong> 길드에 가입 신청 중입니다.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => act({ action: 'cancel_join', requestId: my.myRequest!.id }, '신청을 취소했습니다.')}
          >
            신청 취소
          </Button>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        {guilds.length > 0 ? (
          <Tabs tabs={[...RANK_TABS]} value={key} onChange={setTab} />
        ) : null}
        {guilds.length === 0 ? (
          <Card className="py-10 text-center text-sm text-cdm-fg-muted">
            아직 창설된 길드가 없습니다. 창설권으로 첫 길드를 만들어 보세요.
          </Card>
        ) : (
          ranked.map(({ guild: g, rank, score }) => (
            <GuildRow
              key={g.id}
              rank={rank}
              score={score}
              guild={g}
              skin={rankCards[g.id] ?? null}
              onInfo={() => setInfoGuild(g)}
            />
          ))
        )}
        {guilds.length > 0 ? (
          <style>{`
            .guild-list-crest {
              flex-shrink: 0;
              width: 2.35rem;
              filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--title-midnight) 16%, transparent));
            }
            .guild-list-crest-metal {
              padding: 2px;
              background: linear-gradient(160deg, var(--cdm-highlight-soft), var(--cdm-highlight) 35%, var(--cdm-highlight-strong) 70%, var(--cdm-highlight-soft));
              clip-path: polygon(50% 0, 100% 16%, 100% 64%, 50% 100%, 0 64%, 0 16%);
            }
            .guild-list-crest-inner {
              overflow: hidden;
              background: var(--title-midnight);
              clip-path: polygon(50% 0, 100% 16%, 100% 64%, 50% 100%, 0 64%, 0 16%);
            }
            .guild-list-crest-inner img {
              display: block;
              width: 100%;
              height: 2.65rem;
              object-fit: cover;
            }
          `}</style>
        ) : null}
      </section>

      {infoGuild && (
        <GuildInfoModal
          guild={infoGuild}
          busy={busy}
          canApply={canApply}
          onClose={() => setInfoGuild(null)}
          onJoin={async () => {
            const ok = await act({ action: 'join', guildId: infoGuild.id }, '가입 신청을 보냈어요.');
            if (ok) setInfoGuild(null);
          }}
        />
      )}

      {createOpen && (
        <CreateGuildModal
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={async (name, description) => {
            const ok = await act({ action: 'create', name, description }, '길드를 창설했습니다!');
            if (ok) {
              setCreateOpen(false);
            }
          }}
        />
      )}
    </>
  );
}

export default function GuildListClient({ me }: { me: DevGuildMe }) {
  const { guilds, my, busy, act, hydrated } = useGuildDevApi(me);

  if (!hydrated) return null;

  return <GuildListPanel guilds={guilds} my={my} busy={busy} act={act} variant="page" />;
}

function GuildListCrest({
  src,
  name,
  onOpen,
}: {
  src: string;
  name: string;
  onOpen?: () => void;
}) {
  const crest = (
    <div className="guild-list-crest">
      <div className="guild-list-crest-metal">
        <div className="guild-list-crest-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${name} 길드`} />
        </div>
      </div>
    </div>
  );
  if (!onOpen) return crest;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name} 길드 정보`}
      className="shrink-0 cursor-pointer rounded-cdm-sm bg-transparent p-0 focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)]"
    >
      {crest}
    </button>
  );
}

function GuildRow({
  rank,
  score,
  guild,
  skin,
  onInfo,
}: {
  rank: number;
  score: number;
  guild: GuildSummary;
  skin?: RankCardShopSkinId | null;
  onInfo: () => void;
}) {
  return (
    <RankCardShell
      skin={skin}
      className="px-3 py-2 sm:px-3.5 sm:py-2"
      bodyClassName="flex items-center gap-4"
    >
      <span
        className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${
          rank === 1 ? 'text-cdm-highlight-strong' : 'text-cdm-fg-muted'
        }`}
      >
        {rank}
      </span>
      {guild.markUrl ? (
        <GuildListCrest src={guild.markUrl} name={guild.name} onOpen={onInfo} />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-cdm-fg">{guild.name}</p>
          <span className="shrink-0 rounded-full bg-cdm-bg-elev-2 px-1.5 py-px text-[10px] font-bold text-cdm-fg-muted">
            Lv.{guild.buffCdpLevel}
          </span>
          <span className="min-w-0 truncate text-xs text-cdm-fg-muted">
            <span className="font-semibold text-cdm-fg-subtle">길드장</span>{' '}
            {guild.ownerNickname || '—'}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-cdm-fg-muted">
            {guild.memberCount}/{guild.capacity}
          </span>
        </div>
        {guild.description ? (
          <p className="mt-px truncate text-xs text-cdm-fg-muted">{guild.description}</p>
        ) : null}
      </div>

      <span className="shrink-0 text-sm font-semibold tabular-nums text-cdm-fg">
        {formatGuildRankScore(score)}
      </span>

      <Button size="sm" variant="secondary" onClick={onInfo}>
        정보
      </Button>
    </RankCardShell>
  );
}
