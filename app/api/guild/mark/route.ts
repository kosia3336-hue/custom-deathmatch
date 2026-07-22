import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { GUILD_MARK_MAX_BYTES, GUILD_MARK_MIME } from '@/lib/guild/types';

export const dynamic = 'force-dynamic';

const BUCKET = 'guild-marks';
const ALLOWED = new Set<string>(GUILD_MARK_MIME);

const ERROR_MSG: Record<string, { status: number; msg: string }> = {
  forbidden: { status: 403, msg: '길드장만 마크를 등록할 수 있어요.' },
  insufficient_guild_points: { status: 402, msg: '길드 포인트가 부족해요.' },
  invalid_mark_url: { status: 400, msg: '이미지 주소가 올바르지 않아요.' },
};

function mapError(message: string | undefined | null) {
  if (message) {
    console.warn('[guild:mark] RPC 오류:', message);
    for (const key of Object.keys(ERROR_MSG)) {
      if (message.includes(key)) return ERROR_MSG[key]!;
    }
  }
  return { status: 500, msg: '처리 중 오류가 발생했어요.' };
}

/**
 * POST /api/guild/mark — 길드 마크 이미지 업로드 (multipart 'file').
 * 길드장만 가능. 스토리지 업로드 후 set_guild_mark RPC 로 길드 포인트를 차감하고 URL 을 저장한다.
 */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없어요.' }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: '파일이 없어요.' }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'PNG/JPEG/WebP/GIF 이미지만 등록할 수 있어요.' }, { status: 400 });
  }
  if (file.size > GUILD_MARK_MAX_BYTES) {
    return NextResponse.json({ error: '마크 이미지는 512KB 이하만 가능해요.' }, { status: 400 });
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

  try {
    await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: GUILD_MARK_MAX_BYTES });
  } catch {
    // 이미 존재 — 무시
  }

  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif'
    : 'jpg';
  const path = `${my.guild_id}/${crypto.randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
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
