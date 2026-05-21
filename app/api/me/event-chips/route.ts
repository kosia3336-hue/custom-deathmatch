import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me/event-chips
 * 본인 이벤트 칩 잔액 + 누적 통계.
 */
export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const sb = getSupabaseServiceRole();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('get_event_chip_summary', {
      p_member_id: member.id,
    });
    if (error) {
      console.warn('[api:me:event-chips] RPC 실패:', error.message);
      return NextResponse.json(
        { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json(
      {
        balance: Number(row?.balance ?? 0),
        totalBought: Number(row?.total_bought ?? 0),
        totalWon: Number(row?.total_won ?? 0),
        totalLost: Number(row?.total_lost ?? 0),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
