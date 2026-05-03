/**
 * socket 서버용 Supabase 클라이언트 (service_role).
 *
 * record_game_end 등 RLS 우회가 필요한 작업에 사용.
 * 클라이언트 노출 금지.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. server/.env 를 확인하세요.',
    );
  }

  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * 사용자 access_token 으로 회원 ID 검증.
 * socket 연결 시 클라이언트가 보낸 토큰의 유효성 확인용.
 */
export async function getMemberIdFromToken(accessToken: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  // 검증용으로는 anon 클라이언트로 access_token 만 헤더 세팅
  const verify = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await verify.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
