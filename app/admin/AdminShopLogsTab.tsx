import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import { getRange, getTotalPages, parsePageParam } from '@/lib/pagination';
import { RoutePagination } from '@/components/cdm/Pagination';
import { EmptyState } from '@/components/cdm/EmptyState';
import { CDP_ICON, formatCdp } from '@/lib/cdp/format';
import { labelForType } from '@/lib/cdp/types';

const PAGE_SIZE = 50;

interface RawRow {
  id: string;
  member_id: string;
  price_paid: number;
  name_snapshot: string;
  type_snapshot: string;
  occurred_at: string;
  ledger_ref_kind: string;
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return {
    date: `${yy}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default async function AdminShopLogsTab({ page: pageParam }: { page?: string }) {
  const sb = getSupabaseServiceRole();
  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);

  const res = await sb
    .from('v_admin_shop_logs')
    .select('id, member_id, price_paid, name_snapshot, type_snapshot, occurred_at, ledger_ref_kind', {
      count: 'exact',
    })
    .order('occurred_at', { ascending: false })
    .range(from, to);

  const rows = (res.data ?? []) as unknown as RawRow[];
  const totalCount = res.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  const rowIds = rows.map((r) => r.id);
  const memberIds = [...new Set(rows.map((r) => r.member_id))];

  const shopPurchaseIds = rows.filter((r) => r.ledger_ref_kind === 'shop_purchase').map((r) => r.id);
  const gachaDrawIds = rows.filter((r) => r.ledger_ref_kind === 'gacha_draw').map((r) => r.id);

  const [membersRes, shopLedgerRes, gachaLedgerRes] = await Promise.all([
    memberIds.length
      ? sb.from('members').select('id, nickname').in('id', memberIds)
      : Promise.resolve({ data: [] }),
    shopPurchaseIds.length
      ? sb
          .from('cdp_ledger')
          .select('ref_id, balance_after')
          .eq('ref_kind', 'shop_purchase')
          .in('ref_id', shopPurchaseIds)
      : Promise.resolve({ data: [] }),
    gachaDrawIds.length
      ? sb
          .from('cdp_ledger')
          .select('ref_id, balance_after')
          .eq('ref_kind', 'gacha_draw')
          .in('ref_id', gachaDrawIds)
          .lt('delta', 0)
      : Promise.resolve({ data: [] }),
  ]);

  const memberMap = new Map(
    ((membersRes.data ?? []) as { id: string; nickname: string }[]).map((m) => [m.id, m.nickname]),
  );
  const ledgerMap = new Map<string, number>();
  for (const l of (shopLedgerRes.data ?? []) as { ref_id: string; balance_after: number }[]) {
    ledgerMap.set(l.ref_id, Number(l.balance_after));
  }
  for (const l of (gachaLedgerRes.data ?? []) as { ref_id: string; balance_after: number }[]) {
    ledgerMap.set(l.ref_id, Number(l.balance_after));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-cdm-fg-muted">
        총 <span className="font-semibold text-cdm-fg">{totalCount.toLocaleString()}</span>건
      </p>

      {rows.length === 0 ? (
        <EmptyState title="구매 내역이 없어요" />
      ) : (
        <>
          {/* 데스크톱 테이블 */}
          <div className="hidden overflow-x-auto rounded-cdm-lg border border-cdm-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cdm-border bg-cdm-bg-elev-1 text-left text-xs font-semibold text-cdm-fg-muted">
                  <th className="px-3 py-2 whitespace-nowrap">시간</th>
                  <th className="px-3 py-2 whitespace-nowrap">회원</th>
                  <th className="px-3 py-2">아이템</th>
                  <th className="px-3 py-2 whitespace-nowrap">타입</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">가격</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">구매 전</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">구매 후</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const { date, time } = formatDateTime(r.occurred_at);
                  const balanceAfter = ledgerMap.get(r.id) ?? null;
                  const balanceBefore = balanceAfter !== null ? balanceAfter + Number(r.price_paid) : null;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-cdm-border last:border-0 ${i % 2 === 1 ? 'bg-cdm-bg-elev-1/40' : ''}`}
                    >
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="flex flex-col text-[11px] text-cdm-fg-muted leading-relaxed">
                          <span>{date}</span>
                          <span>{time}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top font-semibold text-cdm-fg whitespace-nowrap">
                        {memberMap.get(r.member_id) ?? '(탈퇴)'}
                      </td>
                      <td className="px-3 py-2.5 align-top text-cdm-fg">{r.name_snapshot}</td>
                      <td className="px-3 py-2.5 align-top text-cdm-fg-muted whitespace-nowrap">
                        {labelForType(r.type_snapshot)}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums whitespace-nowrap">
                        <span className={r.price_paid < 0 ? 'text-cdm-primary' : 'text-cdm-fg'}>
                          {r.price_paid < 0 ? '+' : ''}{CDP_ICON} {formatCdp(Math.abs(r.price_paid))}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-cdm-fg-muted whitespace-nowrap">
                        {balanceBefore !== null ? `${CDP_ICON} ${formatCdp(Math.abs(balanceBefore))}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right tabular-nums text-cdm-fg-muted whitespace-nowrap">
                        {balanceAfter !== null ? `${CDP_ICON} ${formatCdp(balanceAfter)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => {
              const { date, time } = formatDateTime(r.occurred_at);
              const balanceAfter = ledgerMap.get(r.id) ?? null;
              const balanceBefore = balanceAfter !== null ? balanceAfter + Number(r.price_paid) : null;
              return (
                <div
                  key={r.id}
                  className="rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 px-3.5 py-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-cdm-fg">
                      {memberMap.get(r.member_id) ?? '(탈퇴)'}
                    </span>
                    <span className="text-[11px] text-cdm-fg-muted whitespace-nowrap">
                      {date} {time}
                    </span>
                  </div>
                  <p className="text-sm text-cdm-fg">
                    {r.name_snapshot}
                    <span className="ml-1.5 text-[11px] text-cdm-fg-muted">
                      {labelForType(r.type_snapshot)}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-cdm-fg-muted tabular-nums">
                    <span className={r.price_paid < 0 ? 'text-cdm-primary' : ''}>
                      {r.price_paid < 0 ? '획득' : '가격'} {r.price_paid < 0 ? '+' : ''}{CDP_ICON} {formatCdp(Math.abs(r.price_paid))}
                    </span>
                    <span>전 {balanceBefore !== null ? `${CDP_ICON} ${formatCdp(Math.abs(balanceBefore))}` : '—'}</span>
                    <span>후 {balanceAfter !== null ? `${CDP_ICON} ${formatCdp(balanceAfter)}` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <RoutePagination totalPages={totalPages} paramKey="shopLogsPage" />
        </>
      )}
    </div>
  );
}
