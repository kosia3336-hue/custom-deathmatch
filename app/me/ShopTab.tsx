import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { EmptyState } from '@/components/cdm/EmptyState';
import { RoutePagination } from '@/components/cdm/Pagination';
import { getServerSupabase } from '@/lib/supabase/server';
import { CDP_ICON, formatCdp, formatCdpDelta } from '@/lib/cdp/format';
import { parsePageParam, getRange, getTotalPages } from '@/lib/pagination';
import { labelForType } from '@/lib/cdp/types';
import InventoryCard from './InventoryCard';

interface Props {
  memberId: string;
  ledgerPage?: string;
  purchasesPage?: string;
}

const LEDGER_PAGE_SIZE = 20;
const PURCHASES_PAGE_SIZE = 12;

interface CdpRow {
  balance: number;
  total_earned: number;
  total_spent: number;
}

interface LedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_kind: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface PurchaseRow {
  id: string;
  item_id: string;
  price_paid: number;
  name_snapshot: string;
  type_snapshot: string;
  purchased_at: string;
}

const REASON_LABEL: Record<string, string> = {
  rank_win: '랭크 승',
  rank_loss: '랭크 패',
  rank_draw: '무승부',
  rank_win_forfeit: '몰수승',
  shop_purchase: '상점 구매',
  admin_adjust: '운영자 조정',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function reasonDetail(row: LedgerRow): string {
  const meta = row.metadata ?? {};
  if (row.reason === 'rank_win' || row.reason === 'rank_win_forfeit') {
    const tier = (meta as { tier?: string }).tier;
    const bonus = Number((meta as { tier_bonus?: number }).tier_bonus ?? 0);
    if (tier && bonus > 0) return `${tier} +${bonus}`;
    if (tier) return tier;
    return '';
  }
  if (row.reason === 'shop_purchase') {
    return String((meta as { name?: string }).name ?? '');
  }
  if (row.reason === 'admin_adjust') {
    return String((meta as { reason?: string }).reason ?? '');
  }
  return '';
}

export default async function ShopTab({ memberId, ledgerPage, purchasesPage }: Props) {
  const sb = await getServerSupabase();

  const lp = parsePageParam(ledgerPage);
  const pp = parsePageParam(purchasesPage);
  const { from: lFrom, to: lTo } = getRange(lp, LEDGER_PAGE_SIZE);
  const { from: pFrom, to: pTo } = getRange(pp, PURCHASES_PAGE_SIZE);

  const [cdpRes, ledgerRes, purchasesRes] = await Promise.all([
    sb
      .from('member_cdp')
      .select('balance, total_earned, total_spent')
      .eq('member_id', memberId)
      .maybeSingle(),
    sb
      .from('cdp_ledger')
      .select('id, delta, balance_after, reason, ref_kind, metadata, created_at', {
        count: 'exact',
      })
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(lFrom, lTo),
    sb
      .from('shop_purchases')
      .select('id, item_id, price_paid, name_snapshot, type_snapshot, purchased_at', {
        count: 'exact',
      })
      .eq('member_id', memberId)
      .order('purchased_at', { ascending: false })
      .range(pFrom, pTo),
  ]);

  const cdpRow = (cdpRes.data ?? null) as CdpRow | null;
  const balance = Number(cdpRow?.balance ?? 0);
  const totalEarned = Number(cdpRow?.total_earned ?? 0);
  const totalSpent = Number(cdpRow?.total_spent ?? 0);

  const ledgerRows = (ledgerRes.data as unknown as LedgerRow[] | null) ?? [];
  const ledgerCount = ledgerRes.count ?? 0;
  const ledgerTotalPages = getTotalPages(ledgerCount, LEDGER_PAGE_SIZE);

  const purchaseRows = (purchasesRes.data as unknown as PurchaseRow[] | null) ?? [];
  const purchaseCount = purchasesRes.count ?? 0;
  const purchaseTotalPages = getTotalPages(purchaseCount, PURCHASES_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <Card variant="highlight" accent="primary" className="p-4! sm:p-5!">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cdm-fg-muted">
              보유 CDP
            </p>
            <p className="mt-1 text-3xl font-bold text-cdm-fg sm:text-4xl">
              <span aria-hidden className="mr-2">{CDP_ICON}</span>
              <span className="tabular-nums">{formatCdp(balance)}</span>
            </p>
            <p className="mt-1 text-xs text-cdm-fg-muted">
              누적 획득 {formatCdp(totalEarned)} · 누적 소비 {formatCdp(totalSpent)}
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center rounded-cdm-md bg-cdm-primary px-4 py-2 text-sm font-semibold text-white hover:bg-cdm-primary-strong"
          >
            상점으로 이동 →
          </Link>
        </div>
      </Card>

      {/* 소모성 인벤토리 */}
      <InventoryCard />

      {/* 보유 아이템 */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-cdm-fg">
            보유 아이템 <span className="text-cdm-fg-muted">({purchaseCount})</span>
          </h2>
        </div>
        {purchaseRows.length === 0 ? (
          <EmptyState
            title="아직 구매한 아이템이 없어요"
            description="상점에서 다양한 아이템을 만나보세요"
            action={
              <Link
                href="/shop"
                className="text-sm font-semibold text-cdm-primary hover:text-cdm-primary-strong"
              >
                상점 가기 →
              </Link>
            }
          />
        ) : (
          <>
            <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {purchaseRows.map((p) => (
                <li
                  key={p.id}
                  className="rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3"
                >
                  <p className="text-xs text-cdm-fg-muted">{labelForType(p.type_snapshot)}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-cdm-fg">
                    {p.name_snapshot}
                  </p>
                  <p className="mt-1 text-xs text-cdm-fg-subtle tabular-nums">
                    {CDP_ICON} {formatCdp(p.price_paid)} ·{' '}
                    {new Date(p.purchased_at).toLocaleDateString('ko-KR', {
                      timeZone: 'Asia/Seoul',
                    })}
                  </p>
                </li>
              ))}
            </ul>
            <RoutePagination totalPages={purchaseTotalPages} paramKey="purchasesPage" />
          </>
        )}
      </Card>

      {/* CDP 변동 내역 */}
      <Card>
        <h2 className="mb-3 text-base font-semibold text-cdm-fg">
          CDP 변동 내역 <span className="text-cdm-fg-muted">({ledgerCount})</span>
        </h2>
        {ledgerRows.length === 0 ? (
          <EmptyState
            title="아직 CDP 활동이 없어요"
            description="랭크 게임을 플레이하면 CDP 가 적립돼요"
          />
        ) : (
          <>
            <ul role="list" className="divide-y divide-cdm-border">
              {ledgerRows.map((row) => {
                const positive = row.delta > 0;
                const detail = reasonDetail(row);
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-cdm-fg">
                        {REASON_LABEL[row.reason] ?? row.reason}
                        {detail && (
                          <span className="ml-1.5 text-cdm-fg-muted">· {detail}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-cdm-fg-subtle tabular-nums">
                        {formatTime(row.created_at)} · 잔액 {formatCdp(row.balance_after)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        positive ? 'text-emerald-600' : 'text-cdm-accent'
                      }`}
                    >
                      {formatCdpDelta(row.delta)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <RoutePagination totalPages={ledgerTotalPages} paramKey="ledgerPage" />
          </>
        )}
      </Card>
    </div>
  );
}
