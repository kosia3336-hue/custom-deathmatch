import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/safeRedirect';

/**
 * 커스텀 카카오 OAuth 시작.
 * Supabase 내장 카카오 프로바이더 대신 직접 카카오 OAuth URL 을 생성한다.
 * → account_email 스코프를 요청하지 않아 비즈니스 인증 없이 동작.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/';
  const clientId = process.env.KAKAO_CLIENT_ID;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent('KAKAO_CLIENT_ID 환경변수가 설정되지 않았습니다.'), request.url),
    );
  }

  const redirectUri = `${siteUrl}/auth/kakao/callback`;

  const kakaoUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  kakaoUrl.searchParams.set('client_id', clientId);
  kakaoUrl.searchParams.set('redirect_uri', redirectUri);
  kakaoUrl.searchParams.set('response_type', 'code');
  kakaoUrl.searchParams.set('scope', 'profile_nickname'); // 이메일 없이 닉네임만
  // state 에 next 를 담아 CSRF 방지 (프로덕션에선 서명된 nonce 권장)
  kakaoUrl.searchParams.set('state', safeNextPath(next));

  return NextResponse.redirect(kakaoUrl.toString());
}
