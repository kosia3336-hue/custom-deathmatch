import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { pendingId?: string; skinId?: string } | null;
  const pendingId = String(body?.pendingId ?? '');
  const skinId = String(body?.skinId ?? '');
  if (!pendingId || !skinId) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const sb = getSupabaseServiceRole();
  const { data, error } = await (sb.rpc as any)('claim_songpyeon_skin', {
    p_member_id: member.id,
    p_pending_id: pendingId,
    p_skin_id: skinId,
  });
  if (error) {
    const message = (error as { message?: string }).message ?? '';
    if (message.includes('already_owned')) {
      return NextResponse.json({ error: '이미 보유하고 있습니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: '스킨을 받지 못했습니다.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, skinId: data ?? skinId });
}
