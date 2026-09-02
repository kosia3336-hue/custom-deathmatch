import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { verifySsoToken } from '@/lib/ssoToken';

export const dynamic = 'force-dynamic';

/** GET — 내 연동 상태 */
export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ linked: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseServiceRole() as any;
  const { data } = await sb
    .from('linked_accounts')
    .select('dreamshop_user_id, linked_via, linked_at')
    .eq('member_id', member.id)
    .maybeSingle();

  return NextResponse.json({ linked: Boolean(data), link: data ?? null });
}

/**
 * POST — 드림샵이 발급한 토큰으로 연동한다.
 *
 * 토큰은 "이 브라우저가 그 드림샵 계정으로 로그인해 있다" 만 증명한다.
 * 커데매 쪽 신원은 이 요청의 세션(getActiveMember)에서 온다. 즉 두 세션을
 * 모두 가진 사람만 연동할 수 있다 — 그것이 소유 증명이다.
 */
export async function POST(req: Request) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  let token: unknown;
  try {
    token = ((await req.json()) as { token?: unknown }).token;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const claims = verifySsoToken(token);
  if (!claims) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseServiceRole() as any;

  /*
    1회용 토큰. jti 를 먼저 선점해 재사용을 막는다.
    중복이면(23505) 이미 쓰인 토큰이므로 거부한다.
  */
  const { error: jtiErr } = await sb.from('sso_consumed_tokens').insert({
    jti: claims.jti,
    expires_at: new Date(claims.exp * 1000).toISOString(),
  });
  if (jtiErr) {
    return NextResponse.json({ error: 'token_already_used' }, { status: 409 });
  }

  // 이미 연동돼 있으면 그대로 둔다 (덮어쓰면 다른 계정으로 갈아탈 수 있다)
  const { data: mine } = await sb
    .from('linked_accounts')
    .select('dreamshop_user_id')
    .eq('member_id', member.id)
    .maybeSingle();
  if (mine) {
    return NextResponse.json(
      { error: 'already_linked', dreamshopUserId: mine.dreamshop_user_id },
      { status: 409 },
    );
  }

  // 그 드림샵 계정이 다른 커데매 회원에게 붙어 있으면 거부
  const { data: taken } = await sb
    .from('linked_accounts')
    .select('member_id')
    .eq('dreamshop_user_id', claims.sub)
    .maybeSingle();
  if (taken) {
    return NextResponse.json({ error: 'dreamshop_account_taken' }, { status: 409 });
  }

  /*
    연결 경로 기록.
    커데매는 카카오 로그인을 자체 구현해 user_metadata.kakao_id 를 갖는다.
    드림샵이 보낸 kakao_id 와 같으면 같은 카카오 계정임이 확인된 것이다.
  */
  let via: 'kakao_id' | 'explicit' = 'explicit';
  if (claims.kakao_id) {
    const { data: authUser } = await sb.auth.admin.getUserById(member.id);
    const mineKakao = (authUser?.user?.user_metadata as { kakao_id?: string } | undefined)?.kakao_id;
    if (mineKakao && String(mineKakao) === String(claims.kakao_id)) via = 'kakao_id';
  }

  const { error: insErr } = await sb.from('linked_accounts').insert({
    member_id: member.id,
    dreamshop_user_id: claims.sub,
    linked_via: via,
  });
  if (insErr) {
    return NextResponse.json({ error: 'link_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linkedVia: via });
}

/** DELETE — 연동 해제. 해제하면 CDP 조회도 함께 끊긴다. */
export async function DELETE() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseServiceRole() as any;
  await sb.from('linked_accounts').delete().eq('member_id', member.id);
  return NextResponse.json({ ok: true });
}
