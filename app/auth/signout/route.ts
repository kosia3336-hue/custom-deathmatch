import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  return doSignout(request);
}

export async function GET(request: NextRequest) {
  return doSignout(request);
}

async function doSignout(request: NextRequest) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}
