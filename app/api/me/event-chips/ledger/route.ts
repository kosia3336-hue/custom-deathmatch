import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me/event-chips/ledger?limit=&offset=
 * 본인 이벤트 칩 거래 내역 (최신순).
 */
export async function GET(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ entries: [], total: 0 }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

  try {
    const sb = await getServerSupabase();
    const { data, count, error } = await sb
      .from('event_chip_ledger')
      .select('id, delta, balance_after, reason, ref_kind, ref_id, metadata, created_at', {
        count: 'exact',
      })
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn('[api:me:event-chips:ledger] 실패:', error.message);
      return NextResponse.json({ entries: [], total: 0 });
    }

    const entries =
      ((data ?? []) as Array<{
        id: string;
        delta: number;
        balance_after: number;
        reason: string;
        ref_kind: string | null;
        ref_id: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
      }>).map((r) => ({
        id: r.id,
        delta: Number(r.delta),
        balanceAfter: Number(r.balance_after),
        reason: r.reason,
        refKind: r.ref_kind,
        refId: r.ref_id,
        metadata: r.metadata ?? {},
        createdAt: r.created_at,
      }));

    return NextResponse.json({ entries, total: Number(count ?? entries.length) });
  } catch {
    return NextResponse.json({ entries: [], total: 0 });
  }
}
