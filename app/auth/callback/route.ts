import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * 카카오 OAuth 콜백.
 * 1) ?code 를 세션으로 교환
 * 2) 회원 상태에 따라 적절한 곳으로 리다이렉트
 *    - 가입 미완료 → /signup/agreement
 *    - 영구정지   → /banned
 *    - 일시정지   → /suspended
 *    - 정상       → next 또는 /
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (errorParam) {
    const failed = url.clone();
    failed.pathname = '/login';
    failed.search = '';
    failed.searchParams.set('error', errorDescription ?? errorParam);
    return NextResponse.redirect(failed);
  }

  if (!code) {
    const failed = url.clone();
    failed.pathname = '/login';
    failed.search = '';
    failed.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(failed);
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const failed = url.clone();
    failed.pathname = '/login';
    failed.search = '';
    failed.searchParams.set('error', error.message);
    return NextResponse.redirect(failed);
  }

  // 회원 상태 분기는 proxy.ts 가 처리. 여기선 next 로만 보낸다.
  // (proxy 가 가입 미완료/정지 등을 자동 리다이렉트한다)
  const redirect = url.clone();
  redirect.pathname = next.startsWith('/') ? next : '/';
  redirect.search = '';
  return NextResponse.redirect(redirect);
}
