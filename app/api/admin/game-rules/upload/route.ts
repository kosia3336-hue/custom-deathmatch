import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { ensureBucketOnce, readImageUpload } from '@/lib/uploads/image';

export const dynamic = 'force-dynamic';

const BUCKET = 'rule-images';

/** POST /api/admin/game-rules/upload — 룰 에디터 이미지 업로드 (multipart, admin 전용) */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  const upload = await readImageUpload(req);
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  const sb = getSupabaseServiceRole();
  await ensureBucketOnce(sb, BUCKET);

  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${upload.ext}`;

  const { error } = await sb.storage.from(BUCKET).upload(path, upload.buffer, {
    contentType: upload.contentType,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 });
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
