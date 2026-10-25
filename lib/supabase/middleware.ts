/**
 * Next.js 미들웨어용 Supabase 클라이언트.
 * 모든 라우트에서 세션을 갱신/검증하기 위함.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from './database.types';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';
import { getVerifiedUser } from '@/lib/auth/verifiedUser';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // 세션 새로고침(만료된 토큰 자동 갱신) + 토큰 확인. 같은 토큰은 1분 동안 다시 묻지 않는다.
  const user = await getVerifiedUser(supabase);

  return { response, user };
}
