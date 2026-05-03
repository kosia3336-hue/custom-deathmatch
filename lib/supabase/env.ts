/**
 * Supabase 환경변수 헬퍼.
 * 빈 키 상태에서도 import 자체는 실패하지 않도록 lazy 검증.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_URL 가 설정되지 않았습니다. .env.local 을 확인하세요.',
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.',
    );
  }
  return key;
}

/** 키가 모두 세팅되었는지 (UI 가드용) */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
