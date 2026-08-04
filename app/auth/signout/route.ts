import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSiteUrl } from '@/lib/site';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return doSignout(request);
}

export async function GET(request: NextRequest) {
  return doSignout(request);
}

/**
 * 로그아웃 후 /login 으로 보낸다.
 *
 * 리다이렉트 대상은 NEXT_PUBLIC_SITE_URL 기준의 절대 URL 이어야 한다.
 *  - NextResponse.redirect 는 상대 경로를 받지 못하고 즉시 500 으로 죽는다.
 *  - request.nextUrl 의 host 는 프록시 뒤에서 내부 주소로 틀어질 수 있어 쓰지 않는다.
 *    (카카오 OAuth 라우트들도 같은 이유로 getSiteUrl() 을 쓴다)
 *
 * 세션 쿠키 삭제는 응답 객체에 직접 실어야 한다. 그래서 리다이렉트 응답을 먼저 만들고,
 * Supabase 클라이언트의 쿠키 핸들러가 그 응답에 쓰도록 연결한다.
 */
async function doSignout(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', getSiteUrl()));

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as CookieOptions),
        ),
    },
  });

  try {
    await supabase.auth.signOut();
  } catch (err) {
    // 이미 만료된 세션 등 — 어차피 로그아웃이 목적이므로 리다이렉트는 그대로 진행한다.
    console.warn('[auth:signout]', err instanceof Error ? err.message : err);
  }

  return response;
}
