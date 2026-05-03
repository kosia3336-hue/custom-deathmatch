/**
 * 브라우저(Client Component) 용 Supabase 클라이언트.
 * 쿠키 기반 세션을 자동 갱신한다.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserSupabase() {
  if (_client) return _client;
  _client = createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
  return _client;
}
