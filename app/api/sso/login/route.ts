import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createHash } from 'node:crypto';
import { verifySsoToken } from '@/lib/ssoToken';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sso/login — 계정 서비스 토큰으로 커스텀 데스매치에 로그인한다.
 *
 * 화면에는 '일반 로그인' 으로 노출된다. 커데매로 먼저 들어온 사람은 계정
 * 서비스의 이름을 모르기 때문이다(handover/features/sso-dreamshop.md §8).
 *
 * 이미 연동된 회원이면 그 계정으로 들어가고, 처음이면 **인증 계정만** 만든다.
 * members 행은 만들지 않는다 — 커데매는 members 행이 없으면 '가입 미완료'로
 * 보고 약관 동의·닉네임 화면으로 보낸다(middleware). 그 흐름을 그대로 타게 해서
 * 동의 기록과 닉네임 검사를 건너뛰지 않는다.
 */

/** 계정 서비스 사용자 하나에 대응하는 커데매 인증 계정 (실제 메일함이 아니다) */
function deriveCredentials(dreamshopUserId: string): { email: string; password: string } {
  const password = createHash('sha256')
    .update(`sso:${dreamshopUserId}:${process.env.SSO_SHARED_SECRET ?? ''}`)
    .digest('hex');
  return { email: `ds_${dreamshopUserId}@dreamshop.internal`, password };
}

export async function POST(req: Request) {
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
  const admin = getSupabaseServiceRole() as any;

  // 1회용 — jti 를 선점해 재사용을 막는다
  const { error: jtiErr } = await admin.from('sso_consumed_tokens').insert({
    jti: claims.jti,
    expires_at: new Date(claims.exp * 1000).toISOString(),
  });
  if (jtiErr) {
    return NextResponse.json({ error: 'token_already_used' }, { status: 409 });
  }

  const { data: link } = await admin
    .from('linked_accounts')
    .select('member_id')
    .eq('dreamshop_user_id', claims.sub)
    .maybeSingle();

  /*
    이미 연동된 회원이면 제재 상태를 다시 확인한다.
    토큰이 유효해도 정지·탈퇴 계정은 들여보내지 않는다.
  */
  if (link) {
    const { data: priv } = await admin
      .from('members_private')
      .select('status')
      .eq('member_id', link.member_id)
      .maybeSingle();
    const status = priv?.status as string | undefined;
    if (status && status !== 'active') {
      return NextResponse.json({ error: 'account_not_active', status }, { status: 403 });
    }
  }

  /*
    카카오 계정이 같으면 기존 커데매 회원으로 들어간다.

    커데매는 카카오 로그인을 자체 구현해 kakao_<카카오ID>@kakao.internal 로
    계정을 만든다. 계정 서비스가 보낸 kakao_id 가 같다면 같은 사람이므로,
    새 계정을 만들면 전적·CDP·칭호가 딸린 원래 계정과 갈라진다.
  */

  if (!link && claims.kakao_id) {
    const kakaoEmail = `kakao_${claims.kakao_id}@kakao.internal`;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = (list?.users ?? []).find(
      (u: { email?: string }) => u.email === kakaoEmail,
    );
    if (existing) {
      /*
        기존 카카오 계정의 비밀번호는 커데매가 서비스 롤 키로 파생한 값이라
        여기서는 알 수 없다. 대신 연동 기록만 만들어 두고, 로그인은 카카오로
        하도록 안내한다 — 비밀번호를 새로 덮어쓰면 기존 로그인이 깨진다.
      */
      const { data: member } = await admin
        .from('members')
        .select('id')
        .eq('id', existing.id)
        .maybeSingle();

      if (member) {
        await admin
          .from('linked_accounts')
          .insert({
            member_id: member.id,
            dreamshop_user_id: claims.sub,
            linked_via: 'kakao_id',
          })
          .then(
            () => undefined,
            () => undefined,
          );

        return NextResponse.json(
          { error: 'use_kakao_login', linked: true },
          { status: 409 },
        );
      }
    }
  }

  const { email, password } = deriveCredentials(claims.sub);

  const response = NextResponse.json({ ok: true, linked: Boolean(link) });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (xs) =>
          xs.forEach((c) => response.cookies.set(c.name, c.value, c.options as CookieOptions)),
      },
    },
  );

  const first = await supabase.auth.signInWithPassword({ email, password });
  let signInData = first.data;
  const signInError = first.error;

  if (signInError) {
    // 처음 들어온 계정 서비스 사용자 — 인증 계정만 만들고 가입 흐름에 넘긴다
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dreamshop_user_id: claims.sub, provider: 'dreamshop' },
    });
    if (createError) {
      return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    }

    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.error) {
      return NextResponse.json({ error: 'signin_failed' }, { status: 500 });
    }
    signInData = retry.data;
  }

  /*
    가입을 마쳐 members 행이 생겼는데 아직 연동 기록이 없으면 여기서 채운다.
    members 행은 complete_signup RPC 가 만들기 때문에, 최초 로그인 시점에는
    아직 없다. 다음 로그인 때 이 자리에서 이어 붙인다.
  */
  const authUserId = signInData?.user?.id;
  if (!link && authUserId) {
    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle();

    if (member) {
      // 경합으로 이미 들어가 있을 수 있어 실패는 무시한다
      await admin
        .from('linked_accounts')
        .insert({
          member_id: member.id,
          dreamshop_user_id: claims.sub,
          linked_via: 'explicit',
        })
        .then(
          () => undefined,
          () => undefined,
        );
    }
  }

  return response;
}
