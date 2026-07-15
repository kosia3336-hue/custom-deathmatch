import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatCdp } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import InventoryCard from './InventoryCard';

interface Props {
  memberId: string;
}

interface CdpRow {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export default async function ShopTab({ memberId }: Props) {
  const sb = await getServerSupabase();

  const cdpRes = await sb
    .from('member_cdp')
    .select('balance, total_earned, total_spent')
    .eq('member_id', memberId)
    .maybeSingle();

  const cdpRow = (cdpRes.data ?? null) as CdpRow | null;
  const balance = Number(cdpRow?.balance ?? 0);
  const totalEarned = Number(cdpRow?.total_earned ?? 0);
  const totalSpent = Number(cdpRow?.total_spent ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <Card variant="highlight" accent="primary" className="p-4! sm:p-5!">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cdm-fg-muted">
              보유 CDP
            </p>
            <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-cdm-fg sm:text-4xl">
              <CdpIcon size={30} />
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
    </div>
  );
}
