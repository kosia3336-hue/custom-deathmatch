import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { GUILD_MARK_MAX_BYTES } from '@/lib/guild/types';
import { ensureBucketOnce, readImageUpload } from '@/lib/uploads/image';

export const dynamic = 'force-dynamic';

const BUCKET = 'guild-marks';

const ERROR_MSG: Record<string, { status: number; msg: string }> = {
  forbidden: { status: 403, msg: '길드장만 마크를 등록할 수 있습니다.' },
  insufficient_guild_points: { status: 402, msg: '길드 포인트가 부족합니다.' },
  invalid_mark_url: { status: 400, msg: '이미지 주소가 올바르지 않습니다.' },
};

function mapError(message: string | undefined | null) {
  if (message) {
    console.warn('[guild:mark] RPC 오류:', message);
    for (const key of Object.keys(ERROR_MSG)) {
      if (message.includes(key)) return ERROR_MSG[key]!;
    }
  }
  return { status: 500, msg: '처리 중 오류가 발생했습니다.' };
}

/**
 * POST /api/guild/mark — 길드 마크 이미지 업로드 (multipart 'file').
 * 길드장만 가능. 스토리지 업로드 후 set_guild_mark RPC 로 길드 포인트를 차감하고 URL 을 저장한다.
 */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  const upload = await readImageUpload(req, GUILD_MARK_MAX_BYTES);
  if (!upload.ok) {
    const msg = upload.status === 413 ? '마크 이미지는 512KB 이하만 가능합니다.' : upload.error;
    return NextResponse.json({ error: msg }, { status: upload.status });
  }

  const sb = getSupabaseServiceRole();

  // 길드장 여부를 미리 확인 — 스토리지에 쓸데없는 파일을 남기지 않기 위해
  const { data: myRow } = await sb
    .from('guild_members')
    .select('guild_id, role')
    .eq('member_id', member.id)
    .maybeSingle();
  const my = myRow as { guild_id: string; role: string } | null;
  if (!my || my.role !== 'owner') {
    return NextResponse.json({ error: ERROR_MSG.forbidden.msg }, { status: 403 });
  }

  await ensureBucketOnce(sb, BUCKET, GUILD_MARK_MAX_BYTES);

  const path = `${my.guild_id}/${crypto.randomUUID()}.${upload.ext}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, upload.buffer, {
    contentType: upload.contentType,
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 });
  }
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);

  // 주의: sb.rpc 를 변수로 떼어내면 this 바인딩이 끊긴다 — bind 필수
  const rpc = sb.rpc.bind(sb) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const { data, error } = await rpc('set_guild_mark', {
    p_owner: member.id,
    p_url: pub.publicUrl,
  });
  if (error) {
    // 포인트 부족 등으로 실패하면 방금 올린 파일을 정리
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    const e = mapError(error.message);
    return NextResponse.json({ error: e.msg }, { status: e.status });
  }

  return NextResponse.json({ ok: true, url: pub.publicUrl, data });
}
