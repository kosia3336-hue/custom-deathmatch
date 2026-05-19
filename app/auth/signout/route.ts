import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  return doSignout();
}

export async function GET() {
  return doSignout();
}

async function doSignout() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  // 상대 경로 — 배포(0.0.0.0 바인딩·프록시)에서 request.nextUrl.host 가 틀어지는 것 방지
  return NextResponse.redirect('/login');
}
