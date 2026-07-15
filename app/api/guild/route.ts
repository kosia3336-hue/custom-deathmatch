import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { listGuilds, getMyGuildState } from '@/lib/guild/server';

export const dynamic = 'force-dynamic';

/** GET /api/guild — 길드 목록 + 내 길드 상태 */
export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없어요.' }, { status: 503 });
  }
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  const [guilds, my] = await Promise.all([listGuilds(), getMyGuildState(member.id)]);
  return NextResponse.json({ guilds, my });
}
