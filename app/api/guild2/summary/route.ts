import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getMyGuildState } from '@/lib/guild/server';
import { isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { loadActiveGuildSummary } from '@/lib/guild-v4/server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '길드를 찾을 수 없습니다.' }, { status: 404 });
  }
  try {
    const guild = await loadActiveGuildSummary(id);
    if (!guild) {
      return NextResponse.json({ error: '길드를 찾을 수 없습니다.' }, { status: 404 });
    }
    const member = await getActiveMember();
    let canApply = false;
    if (member) {
      const my = await getMyGuildState(member.id);
      canApply = !my.guild && !my.myRequest;
    }
    return NextResponse.json({ guild, canApply });
  } catch (err) {
    console.error('[guild2:summary]', (err as Error).message);
    return NextResponse.json({ error: '길드 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
