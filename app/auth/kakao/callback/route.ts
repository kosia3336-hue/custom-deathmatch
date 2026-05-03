import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import type { CookieOptions } from '@supabase/ssr';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_URL = 'https://kapi.kakao.com/v2/user/me';

/** 카카오 authorization code → access_token 교환 */
async function exchangeKakaoCode(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_CLIENT_ID!,
    redirect_uri: redirectUri,
    code,
  });

  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  if (clientSecret) params.set('client_secret', clientSecret);

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`카카오 토큰 교환 실패: ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** 카카오 access_token → 프로필 조회 */
async function fetchKakaoProfile(accessToken: string): Promise<{ id: string; nickname: string | null }> {
  const res = await fetch(KAKAO_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 프로필 조회 실패: ${res.status}`);
  }

  const data = (await res.json()) as {
    id: number;
    properties?: { nickname?: string };
    kakao_account?: { profile?: { nickname?: string } };
  };

  const nickname =
    data.kakao_account?.profile?.nickname ?? data.properties?.nickname ?? null;

  return { id: String(data.id), nickname };
}

/**
 * 카카오 ID 로 Supabase 이메일/패스워드를 결정론적으로 생성.
 * 실제로 이메일을 사용하지 않으므로 @kakao.internal 도메인 사용.
 */
function deriveCredentials(kakaoId: string): { email: string; password: string } {
  const secret = process.env.KAKAO_USER_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const password = createHmac('sha256', secret).update(`kakao:${kakaoId}`).digest('hex');
  return {
    email: `kakao_${kakaoId}@kakao.internal`,
    password,
  };
}

/**
 * 커스텀 카카오 OAuth 콜백.
 *
 * 흐름:
 * 1. 카카오 code → access_token 교환
 * 2. 카카오 유저 ID/닉네임 조회
 * 3. Supabase 에 fake email 로 로그인 시도
 *    - 없으면 admin API 로 유저 생성 후 재로그인
 * 4. 세션 쿠키 설정 → next 로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '/';
  const errorParam = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDesc ?? errorParam)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const redirectUri = `${siteUrl}/auth/kakao/callback`;

  // state 는 next 경로. 상대 경로만 허용해 오픈 리다이렉트 방지.
  const nextPath = state.startsWith('/') ? state : '/';
  const finalRedirect = new URL(nextPath, siteUrl);

  // 세션 쿠키를 응답에 심기 위한 Response 먼저 생성
  const response = NextResponse.redirect(finalRedirect);

  try {
    // ── 1. 카카오 토큰 & 프로필 ────────────────────────────────────
    const kakaoToken = await exchangeKakaoCode(code, redirectUri);
    const profile = await fetchKakaoProfile(kakaoToken);

    // ── 2. Supabase 자격증명 ───────────────────────────────────────
    const { email, password } = deriveCredentials(profile.id);

    // ── 3. SSR 클라이언트 (쿠키 핸들러 포함) ──────────────────────
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (xs) =>
            xs.forEach((c) =>
              response.cookies.set(c.name, c.value, c.options as CookieOptions),
            ),
        },
      },
    );

    // ── 4. 로그인 시도 ─────────────────────────────────────────────
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // 계정이 없으면 admin 으로 생성
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          kakao_id: profile.id,
          provider: 'kakao',
        },
      });

      if (createError) {
        throw new Error(`유저 생성 실패: ${createError.message}`);
      }

      // 생성 후 재로그인
      const { error: signIn2Error } = await supabase.auth.signInWithPassword({ email, password });
      if (signIn2Error) {
        throw new Error(`로그인 재시도 실패: ${signIn2Error.message}`);
      }
    }

    return response;
  } catch (err) {
    console.error('[Kakao OAuth Callback]', err);
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
