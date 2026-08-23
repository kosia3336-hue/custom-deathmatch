import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { loadUnseenGuildRankPayouts } from '@/lib/guild-v4/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ payouts: [] });
  try {
    const payouts = await loadUnseenGuildRankPayouts(member.id);
    return NextResponse.json({ payouts });
  } catch (err) {
    console.error('[guild2:payouts]', (err as Error).message);
    return NextResponse.json({ payouts: [] });
  }
}
