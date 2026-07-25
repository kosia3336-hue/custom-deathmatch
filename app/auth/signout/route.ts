import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  return doSignout(request);
}

export async function GET(request: Request) {
  return doSignout(request);
}

async function doSignout(request: Request) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  // NextResponse.redirect 는 절대 URL이 필요하다. 배포(0.0.0.0 바인딩·프록시) 환경에서
  // request.url 의 host 가 틀어질 수 있어, 신뢰 가능한 NEXT_PUBLIC_SITE_URL 을 우선 쓰고
  // 없을 때만 request.url 의 origin 으로 폴백한다.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(new URL('/login', base));
}
