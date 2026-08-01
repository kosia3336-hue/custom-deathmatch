import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const BUCKET = 'rule-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** POST /api/admin/game-rules/upload — 룰 에디터 이미지 업로드 (multipart, admin 전용) */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
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
    return NextResponse.json({ error: 'PNG/JPEG/WebP/GIF 이미지만 업로드할 수 있습니다.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '이미지는 5MB 이하만 가능합니다.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();

  // 버킷 없으면 생성 (public 읽기)
  try {
    await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  } catch {
    // 이미 존재 — 무시
  }

  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif'
    : 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 });
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
