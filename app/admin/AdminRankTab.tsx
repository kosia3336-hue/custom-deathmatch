import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import AdminRankTools from '@/app/admin/AdminRankTools';

const TIER_ORDER = ['unranked', 'bronze', 'silver', 'gold', 'diamond'] as const;
const TIER_LABEL: Record<string, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
};

export default async function AdminRankTab() {
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: seasons, error } = await db
    .from('rank_seasons')
    .select('id, name, is_active, started_at, ended_at')
    .order('id', { ascending: false });

  if (error) {
    return <EmptyState title="랭크 시즌 테이블을 불러오지 못했습니다" />;
  }

  const rows = (seasons ?? []) as Array<{
    id: number;
    name: string;
    is_active: boolean | null;
    started_at: string;
    ended_at: string | null;
  }>;

  if (rows.length === 0) {
    return (
      <>
        <p className="mb-4 text-sm text-cdm-fg-muted">
          등록된 시즌이 없습니다. 새 시즌을 시작하면 랭크 매칭이 가능합니다.
        </p>
        <AdminRankTools
          seasons={[]}
          tierBins={TIER_ORDER.map((tier) => ({
            tier,
            label: TIER_LABEL[tier] ?? tier,
            count: 0,
          }))}
          challengerSlots={0}
          activeSeasonId={null}
        />
      </>
    );
  }

  const active = rows.find((s) => s.is_active);
  let tierBins = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier] ?? tier,
    count: 0,
  }));
  let challengerSlots = 0;

  const CHALLENGER_RP_MIN = 150;

  if (active) {
    const { data: rsRows } = await db
      .from('rank_stats')
      .select('tier, rp, placement_done, season_wins')
      .eq('season_id', active.id);

    const counts: Record<string, number> = {};
    for (const r of rsRows ?? []) {
      const t = String(r.tier);
      counts[t] = (counts[t] ?? 0) + 1;
    }

    const diamondSorted = ((rsRows ?? []) as Array<{ tier: string; rp: number; placement_done: boolean; season_wins: number }>)
      .filter((r) => r.tier === 'diamond' && r.placement_done)
      .sort((a, b) => Number(b.rp) - Number(a.rp) || Number(b.season_wins) - Number(a.season_wins));

    challengerSlots = diamondSorted
      .slice(0, 3)
      .filter((r) => Number(r.rp) >= CHALLENGER_RP_MIN)
      .length;

    tierBins = TIER_ORDER.map((tier) => ({
      tier,
      label: TIER_LABEL[tier] ?? tier,
      count: counts[tier] ?? 0,
    }));
  }

  return (
    <AdminRankTools
      seasons={rows}
      tierBins={tierBins}
      challengerSlots={challengerSlots}
      activeSeasonId={active?.id ?? null}
    />
  );
}
