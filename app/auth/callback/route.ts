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
    const params = new URLSearchParams({
      error: errorDescription ?? errorParam,
    });
    return NextResponse.redirect(`/login?${params}`);
  }

  if (!code) {
    const params = new URLSearchParams({ error: 'missing_code' });
    return NextResponse.redirect(`/login?${params}`);
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const params = new URLSearchParams({ error: error.message });
    return NextResponse.redirect(`/login?${params}`);
  }

  // 회원 상태 분기는 middleware 가 처리. 여기선 next 로만 보낸다.
  const target = next.startsWith('/') ? next : '/';
  return NextResponse.redirect(target);
}
