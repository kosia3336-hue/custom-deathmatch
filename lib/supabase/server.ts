/**
 * 서버 컴포넌트 / Route Handler / Server Action 용 Supabase 클라이언트.
 *
 * Next.js 16 App Router 의 next/headers cookies() 를 사용해 SSR 세션을 유지한다.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';

export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component 에서는 set 이 동작하지 않을 수 있다 (next 정상 동작)
        }
      },
    },
  });
}
