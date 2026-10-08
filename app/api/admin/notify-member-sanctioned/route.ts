import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import { notifyMemberSanctioned } from '@/lib/cdp/notify';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/notify-member-sanctioned `{ memberId }` 또는 `{ reportId }`
 *
 * 관리자 화면이 정지·영구정지 RPC 를 성공한 뒤 부른다. 게임 서버는 소켓을
 * 연결할 때만 회원 상태를 보므로, 접속 중인 회원은 여기서 끊어 줘야 정지가
 * 바로 적용된다. 신고 처리 화면은 신고 id 만 알아서 대상 회원은 여기서 찾는다.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { memberId?: unknown; reportId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  let memberId = typeof body.memberId === 'string' ? body.memberId : '';

  if (!memberId && typeof body.reportId === 'string' && body.reportId) {
    if (!isSupabaseServiceRoleConfigured()) {
      return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
    }
    const { data } = await getSupabaseServiceRole()
      .from('reports')
      .select('target_id')
      .eq('id', body.reportId)
      .maybeSingle();
    memberId = (data as { target_id?: string | null } | null)?.target_id ?? '';
  }

  if (!memberId) return NextResponse.json({ error: '대상 회원이 없습니다.' }, { status: 400 });

  await notifyMemberSanctioned(memberId);
  return NextResponse.json({ ok: true });
}
