import { NextResponse, type NextRequest } from 'next/server';
import { requireCheonhaAdmin } from '@/lib/auth/require-cheonha';
import { isDevAuthUser, listDevMembers } from '@/lib/auth/dev-users';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** GET /api/admin/dev-switch — 데브 유저 목록. 닉 천하만. */
export async function GET() {
  const me = await requireCheonhaAdmin();
  if (!me) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없습니다.', 503);

  try {
    const users = await listDevMembers(getSupabaseServiceRole());
    return NextResponse.json({ users });
  } catch (e) {
    console.warn('[dev-switch:list]', (e as Error).message);
    return err('목록을 불러오지 못했습니다.', 500);
  }
}

/** POST /api/admin/dev-switch `{ memberId }` — 그 데브 유저로 세션 교체. */
export async function POST(req: NextRequest) {
  const me = await requireCheonhaAdmin();
  if (!me) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없습니다.', 503);

  let memberId = '';
  try {
    const body = (await req.json()) as { memberId?: string };
    memberId = String(body.memberId ?? '').trim();
  } catch {
    return err('잘못된 JSON');
  }
  if (!memberId) return err('memberId가 필요합니다.');
  if (memberId === me.id) return err('이미 그 계정입니다.');

  try {
    const admin = getSupabaseServiceRole();
    const { data: got, error: getErr } = await admin.auth.admin.getUserById(memberId);
    if (getErr || !got.user) return err('회원을 찾을 수 없습니다.', 404);
    if (!isDevAuthUser(got.user)) return err('데브 유저가 아닙니다.', 403);

    const email = got.user.email;
    if (!email) return err('이메일이 없는 계정입니다.', 400);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !link.properties?.hashed_token) {
      console.warn('[dev-switch] generateLink', linkErr?.message);
      return err('전환 링크를 만들지 못했습니다.', 500);
    }

    const supabase = await getServerSupabase();
    const { error: otpErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (otpErr) {
      const retry = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: link.properties.hashed_token,
      });
      if (retry.error) {
        console.warn('[dev-switch] verifyOtp', otpErr.message, retry.error.message);
        return err('세션 전환에 실패했습니다.', 500);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn('[dev-switch]', (e as Error).message);
    return err('전환 실패', 500);
  }
}
