import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { Card } from '@/components/cdm/Card';
import type { ShopItem, CdpSummary } from '@/lib/cdp/types';
import { LIVE_SHOP_PACKS } from '@/lib/shop/dev-pack';
import type { RankTier } from '@/shared/types/rank';
import { isDevOnlyShopItem } from '@/lib/cdp/shop-filter';
import { formatCdp } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import ShopClient from './ShopClient';

export const metadata: Metadata = {
  title: '상점',
  description: 'CDP 로 다양한 아이템을 구매할 수 있습니다.',
};

export const dynamic = 'force-dynamic';

function isRankTier(value: string | undefined): value is RankTier {
  return value === 'unranked' || value === 'bronze' || value === 'silver' || value === 'gold' || value === 'diamond' || value === 'challenger';
}

interface Props {
  searchParams: Promise<{ type?: string }>;
}

interface ShopItemRowSel {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  is_active: boolean;
  is_limited: boolean;
  payload: Record<string, unknown> | null;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
}

interface CdpRowSel {
  balance: number;
  total_earned: number;
  total_spent: number;
}

interface OwnedRowSel {
  item_id: string;
}

export default async function ShopPage({ searchParams }: Props) {
  const member = await getActiveMember();
  // middleware 가 비로그인을 차단하지만 이중 가드.
  if (!member) redirect('/login?next=/shop');

  const sp = await searchParams;
  const initialType = sp.type === 'all' || !sp.type ? 'consumable' : sp.type;

  const sb = await getServerSupabase();
  const nowIso = new Date().toISOString();

  const itemsRes = await sb
    .from('shop_items')
    .select(
      'id, type, name, description, price, stock, is_active, is_limited, payload, available_from, available_until, sort_order',
    )
    .eq('is_active', true)
    .or(`available_from.is.null,available_from.lte.${nowIso}`)
    .or(`available_until.is.null,available_until.gt.${nowIso}`)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  let songpyeonBalance = 0;
  let ownedSkinIds: string[] = [];
  let pendingSkinPick: { pendingId: string; itemId: string } | null = null;
  if (isSupabaseServiceRoleConfigured()) {
    const service = getSupabaseServiceRole();
    const [burned, skins, pending] = await Promise.all([
      (service.rpc as any)('burn_songpyeon_if_ended', { p_member_id: member.id }).then(
        (res: { data?: number | null; error?: unknown }) => (res.error ? 0 : Number(res.data ?? 0)),
        () => 0,
      ),
      service.from('member_skins').select('skin_id').eq('member_id', member.id).is('revoked_at', null),
      (service.from as any)('songpyeon_skin_grants')
        .select('id, item_id')
        .eq('member_id', member.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()
        .then((res: { data?: { id?: string; item_id?: string } | null }) => res.data ?? null)
        .catch(() => null),
    ]);
    songpyeonBalance = burned;
    ownedSkinIds = ((skins.data ?? []) as Array<{ skin_id: string }>).map((row) => row.skin_id);
    const pendingRow = pending as { id?: string; item_id?: string } | null;
    if (pendingRow?.id && pendingRow.item_id) {
      pendingSkinPick = { pendingId: pendingRow.id, itemId: pendingRow.item_id };
    }
  }

  const itemRows = ((itemsRes.data as unknown as ShopItemRowSel[] | null) ?? []).filter(
    (r) => !isDevOnlyShopItem({ payload: r.payload ?? {} }),
  );
  const items: ShopItem[] = itemRows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    description: r.description ?? '',
    price: Number(r.price),
    stock: r.stock,
    isActive: r.is_active,
    isLimited: r.is_limited,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    availableFrom: r.available_from,
    availableUntil: r.available_until,
    sortOrder: Number(r.sort_order),
  }));

  const [cdpRes, ownedRes, titlesRes, activeSeasonRes] = await Promise.all([
    sb.from('member_cdp').select('balance, total_earned, total_spent').eq('member_id', member.id).maybeSingle(),
    sb.from('shop_purchases').select('item_id').eq('member_id', member.id),
    sb.from('member_titles').select('title_id').eq('member_id', member.id).is('revoked_at', null),
    sb.from('rank_seasons').select('id, is_active').eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const cdpRow = (cdpRes.data ?? null) as CdpRowSel | null;
  const cdp: CdpSummary = {
    balance: Number(cdpRow?.balance ?? 0),
    totalEarned: Number(cdpRow?.total_earned ?? 0),
    totalSpent: Number(cdpRow?.total_spent ?? 0),
  };

  const ownedIds = ((ownedRes.data ?? []) as unknown as OwnedRowSel[]).map((r) => r.item_id);

  // 거상(first_merchant) 칭호 보유 여부 + 시즌 활성 여부 → 10% 할인 활성 여부
  const ownedTitleSet = new Set(
    ((titlesRes.data ?? []) as unknown as Array<{ title_id: string }>).map((r) => r.title_id),
  );
  const activeSeasonId = (activeSeasonRes.data as { id?: number } | null)?.id ?? null;

  let viewerTier: RankTier = 'unranked';
  if (activeSeasonId !== null) {
    const statsRes = await sb
      .from('rank_stats')
      .select('tier')
      .eq('season_id', activeSeasonId)
      .eq('member_id', member.id)
      .maybeSingle();
    const tier = (statsRes.data as { tier?: string } | null)?.tier;
    viewerTier = isRankTier(tier) ? tier : 'unranked';
  }

  let merchantDiscount = false;
  if (activeSeasonId !== null) {
    for (const r of itemRows) {
      const p = (r.payload ?? {}) as { kind?: string; title_id?: string; season_id?: string | number };
      if (p.kind !== 'first_merchant') continue;
      if (typeof p.title_id !== 'string') continue;
      const sid = typeof p.season_id === 'string' ? Number(p.season_id) : (p.season_id ?? null);
      if (sid !== activeSeasonId) continue;
      if (ownedTitleSet.has(p.title_id)) {
        merchantDiscount = true;
        break;
      }
    }
  }

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">상점</h1>
        </header>

        <Card variant="highlight" accent="primary" className="p-4! sm:p-5!">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cdm-fg-muted">
                보유 CDP
              </p>
              <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-cdm-fg sm:text-4xl">
                <CdpIcon size={30} />
                <span className="tabular-nums">{formatCdp(cdp.balance)}</span>
              </p>
              <p className="mt-1 text-xs text-cdm-fg-muted">
                누적 획득 {formatCdp(cdp.totalEarned)} · 누적 소비 {formatCdp(cdp.totalSpent)}
              </p>
            </div>
          </div>
        </Card>

        <ShopClient
          items={items}
          ownedIds={ownedIds}
          initialBalance={cdp.balance}
          initialType={initialType}
          merchantDiscount={merchantDiscount}
          songpyeonBalance={songpyeonBalance}
          ownedSkinIds={ownedSkinIds}
          pendingSkinPick={pendingSkinPick}
          packItems={LIVE_SHOP_PACKS}
          viewerTier={viewerTier}
        />
      </main>
    </>
  );
}
