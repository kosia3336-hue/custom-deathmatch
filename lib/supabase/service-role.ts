/**
 * 서비스 롤(Service Role) Supabase 클라이언트.
 * RLS 를 우회하는 관리 작업 전용 — 서버(Route Handler / Server Action)에서만 사용.
 * SUPABASE_SERVICE_ROLE_KEY 는 절대 클라이언트 번들에 노출되면 안 된다.
 *
 * NOTE: 이 파일은 원본 저장소에서 .gitignore(`supabase`) 규칙으로 누락되어
 *       사용처(getSupabaseServiceRole / isSupabaseServiceRoleConfigured) 기준으로 복원됨.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { getSupabaseUrl } from './env';

let _client: SupabaseClient<Database> | null = null;

function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** 서비스 롤 키가 모두 설정되었는지 (가드용) */
export function isSupabaseServiceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getServiceRoleKey());
}

export function getSupabaseServiceRole(): SupabaseClient<Database> {
  if (_client) return _client;

  const key = getServiceRoleKey();
  if (!key) {
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.',
    );
  }

  _client = createClient<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
