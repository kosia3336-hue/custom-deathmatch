import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const DEV_SWITCH_OWNER_NICK = '천하';

export interface DevMemberRow {
  id: string;
  nickname: string;
}

export function isDevAuthUser(user: Pick<User, 'email' | 'user_metadata'>): boolean {
  const email = user.email ?? '';
  if (email.endsWith('@dummy.internal')) return true;
  return user.user_metadata?.dummy === true;
}

export function isDevSwitchOwner(m: { nickname: string; role: string }): boolean {
  return m.nickname === DEV_SWITCH_OWNER_NICK && m.role === 'admin';
}

/** 천하(관리자) 또는 더미 세션이면 데브 전환 메뉴·API를 쓸 수 있다. */
export function canUseDevSwitch(
  member: { nickname: string; role: string },
  authUser: Pick<User, 'email' | 'user_metadata'> | null,
): boolean {
  if (isDevSwitchOwner(member)) return true;
  return authUser != null && isDevAuthUser(authUser);
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
  return sortDevSwitchTargets(rows);
}

/** 더미 회원 + 천하. 서로 전환할 대상 목록. */
export async function listDevSwitchTargets(
  sb: SupabaseClient<Database>,
): Promise<DevMemberRow[]> {
  const dummies = await listDevMembers(sb);
  const { data: owner, error } = await sb
    .from('members')
    .select('id, nickname')
    .eq('nickname', DEV_SWITCH_OWNER_NICK)
    .is('withdrawn_at', null)
    .maybeSingle();
  if (error) throw error;

  const rows = [...dummies];
  const ownerRow = owner as DevMemberRow | null;
  if (ownerRow && !rows.some((r) => r.id === ownerRow.id)) {
    rows.push(ownerRow);
  }
  return sortDevSwitchTargets(rows);
}

function sortDevSwitchTargets(rows: DevMemberRow[]): DevMemberRow[] {
  return [...rows].sort((a, b) => {
    if (a.nickname === DEV_SWITCH_OWNER_NICK) return -1;
    if (b.nickname === DEV_SWITCH_OWNER_NICK) return 1;
    return a.nickname.localeCompare(b.nickname, 'ko');
  });
}
