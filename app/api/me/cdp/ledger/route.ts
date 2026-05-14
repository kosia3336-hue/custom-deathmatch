import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { parsePageParam, getRange, getTotalPages, DEFAULT_PAGE_SIZE } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = DEFAULT_PAGE_SIZE; // 20

interface LedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_kind: string;
  ref_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * GET /api/me/cdp/ledger?page=N — 본인 CDP 원장.
 * RLS 가 본인 행만 SELECT 허용하므로 일반 클라이언트로 안전 조회.
 */
export async function GET(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ rows: [], totalCount: 0, totalPages: 0, page: 1 });
  }

  const page = parsePageParam(req.nextUrl.searchParams.get('page') ?? undefined);
  const { from, to } = getRange(page, PAGE_SIZE);

  try {
    const sb = await getServerSupabase();
    const { data, count, error } = await sb
      .from('cdp_ledger')
      .select('id, delta, balance_after, reason, ref_kind, ref_id, metadata, created_at', {
        count: 'exact',
      })
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ rows: [], totalCount: 0, totalPages: 0, page });
    }

    const rows = (data as unknown as LedgerRow[] | null) ?? [];
    const totalCount = typeof count === 'number' ? count : 0;

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        delta: Number(r.delta),
        balanceAfter: Number(r.balance_after),
        reason: r.reason,
        refKind: r.ref_kind,
        refId: r.ref_id,
        metadata: (r.metadata ?? {}) as Record<string, unknown>,
        createdAt: r.created_at,
      })),
      totalCount,
      totalPages: getTotalPages(totalCount, PAGE_SIZE),
      page,
    });
  } catch {
    return NextResponse.json({ rows: [], totalCount: 0, totalPages: 0, page });
  }
}
