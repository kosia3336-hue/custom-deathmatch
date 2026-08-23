import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface DevMemberRow {
  id: string;
  nickname: string;
}

export function isDevAuthUser(user: Pick<User, 'email' | 'user_metadata'>): boolean {
  const email = user.email ?? '';
  if (email.endsWith('@dummy.internal')) return true;
  return user.user_metadata?.dummy === true;
}

/** auth 더미 계정 + members 행. 닉을 코드에 적지 않는다. */
export async function listDevMembers(
  sb: SupabaseClient<Database>,
): Promise<DevMemberRow[]> {
  const raw = sb as unknown as SupabaseClient;
  const ids: string[] = [];

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await raw.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (isDevAuthUser(u)) ids.push(u.id);
    }
    if (data.users.length < 200) break;
  }

  if (ids.length === 0) return [];

  const { data: members, error: memErr } = await sb
    .from('members')
    .select('id, nickname')
    .in('id', ids)
    .is('withdrawn_at', null);
  if (memErr) throw memErr;

  const rows = (members ?? []) as unknown as DevMemberRow[];
  return rows.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
}
