import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const BUCKET = 'attachments';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

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

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'PNG/JPEG/WebP/GIF 이미지만 첨부할 수 있습니다.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '이미지는 5MB 이하만 가능합니다.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();
  try {
    await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  } catch {
    // 이미 존재 — 무시
  }

  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif'
    : 'jpg';
  const path = `${member.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
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
