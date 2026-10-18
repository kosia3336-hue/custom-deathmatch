import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** 편지 제목 상한 (우편 발송과 같은 기준) */
const MAX_TITLE = 100;

/**
 * POST /api/admin/notify-inquiry-answered — 답변한 문의를 질문한 회원의 우편함에 넣는다.
 *
 * 답변 자체는 admin_answer_inquiry RPC 가 남기고, 이 라우트는 DB 에 저장된 답변을 읽어 편지로만 옮긴다.
 * source_key 가 문의마다 하나라 다시 불러도 한 통만 남는다.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  let inquiryId = '';
  try {
    inquiryId = String(((await req.json()) as { inquiryId?: unknown }).inquiryId ?? '').trim();
  } catch {
    // 아래에서 걸러진다
  }
  if (!inquiryId) return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 400 });

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: q, error } = await db
    .from('inquiries')
    .select('id, author_id, title, answer_body')
    .eq('id', inquiryId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: '문의를 불러오지 못했습니다.' }, { status: 500 });
  if (!q?.author_id || !q.answer_body) {
    return NextResponse.json({ error: '답변이 등록된 문의가 아닙니다.' }, { status: 409 });
  }

  const subject = String(q.title ?? '').trim() || '문의';
  // 제목이 상한을 넘으면 문의 제목 쪽을 줄인다 — 문장 틀은 남긴다
  const room = MAX_TITLE - '문의하신 「」에 답변드립니다.'.length;
  const shortSubject = subject.length > room ? `${subject.slice(0, room - 1)}…` : subject;
  const { error: insErr } = await db.from('mailbox_items').upsert(
    {
      member_id: q.author_id,
      source_key: `inquiry:${q.id}`,
      kind: 'system',
      title: `문의하신 「${shortSubject}」에 답변드립니다.`,
      body: q.answer_body,
      sender: '운영팀',
      payload: { inquiryId: q.id },
    },
    { onConflict: 'member_id,source_key', ignoreDuplicates: true },
  );
  if (insErr) {
    console.warn('[admin:notify-inquiry-answered]', insErr.message);
    return NextResponse.json({ error: '우편을 보내지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
