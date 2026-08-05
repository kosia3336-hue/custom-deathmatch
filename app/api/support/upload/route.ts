import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { ensureBucketOnce, readImageUpload } from '@/lib/uploads/image';

export const dynamic = 'force-dynamic';

const BUCKET = 'attachments';

/**
 * POST /api/support/upload — 문의/신고 스크린샷 업로드 (multipart 'file').
 * attach_files 에 target 미지정 행을 만들고 {id, url} 반환.
 * 제출 성공 후 /api/support/attach 로 target 을 연결한다.
 */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  const upload = await readImageUpload(req);
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  const sb = getSupabaseServiceRole();
  await ensureBucketOnce(sb, BUCKET);

  const path = `${member.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${upload.ext}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, upload.buffer, {
    contentType: upload.contentType,
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 });
  }
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: insErr } = await (sb.from('attach_files') as any)
    .insert({ member_id: member.id, url: pub.publicUrl })
    .select('id, url')
    .single();
  if (insErr) {
    return NextResponse.json({ error: '첨부 기록 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: (row as { id: string }).id, url: (row as { url: string }).url });
}
