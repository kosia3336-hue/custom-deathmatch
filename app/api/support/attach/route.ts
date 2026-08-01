import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

interface Body {
  fileIds?: string[];
  targetKind?: 'inquiry' | 'report';
  targetId?: string;
}

/** POST /api/support/attach — 업로드된 첨부를 문의/신고에 연결 (본인 것만) */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const fileIds = (body.fileIds ?? []).filter((x) => typeof x === 'string').slice(0, 10);
  const targetKind = body.targetKind;
  const targetId = body.targetId;
  if (fileIds.length === 0 || (targetKind !== 'inquiry' && targetKind !== 'report') || !targetId) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();

  // 대상 소유 검증 — 본인이 작성한 문의/신고에만 연결 가능
  if (targetKind === 'inquiry') {
    const { data } = await sb.from('inquiries').select('author_id').eq('id', targetId).maybeSingle();
    if ((data as { author_id?: string } | null)?.author_id !== member.id) {
      return NextResponse.json({ error: '연결 대상이 올바르지 않습니다.' }, { status: 403 });
    }
  } else {
    const { data } = await sb.from('reports').select('reporter_id').eq('id', targetId).maybeSingle();
    if ((data as { reporter_id?: string } | null)?.reporter_id !== member.id) {
      return NextResponse.json({ error: '연결 대상이 올바르지 않습니다.' }, { status: 403 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('attach_files') as any)
    .update({ target_kind: targetKind, target_id: targetId })
    .in('id', fileIds)
    .eq('member_id', member.id)
    .is('target_id', null);
  if (error) {
    return NextResponse.json({ error: '첨부 연결에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
