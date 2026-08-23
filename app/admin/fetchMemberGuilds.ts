import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface AdminMemberGuild {
  name: string;
  markUrl: string | null;
}

/**
 * 회원 → 가입 길드. 해체된 길드는 빼다.
 * 기존 길드 RPC/`lib/guild`는 쓰지 않는다.
 * `database.types.ts`에 길드 테이블이 없어 untyped client로 조회한다.
 */
export async function fetchMemberGuilds(
  sb: SupabaseClient<Database>,
  memberIds: string[],
): Promise<Map<string, AdminMemberGuild>> {
  const map = new Map<string, AdminMemberGuild>();
  if (memberIds.length === 0) return map;

  const raw = sb as unknown as SupabaseClient;
  const { data: memberships } = await raw
    .from('guild_members')
    .select('member_id, guild_id')
    .in('member_id', memberIds);
  const rows = (memberships ?? []) as { member_id: string; guild_id: string }[];
  if (rows.length === 0) return map;

  const guildIds = [...new Set(rows.map((r) => r.guild_id))];
  const { data: guilds } = await raw
    .from('guilds')
    .select('id, name, mark_url')
    .in('id', guildIds)
    .is('disbanded_at', null);

  const guildMap = new Map<string, AdminMemberGuild>();
  for (const g of (guilds ?? []) as { id: string; name: string; mark_url: string | null }[]) {
    guildMap.set(g.id, { name: g.name, markUrl: g.mark_url ?? null });
  }
  for (const row of rows) {
    const g = guildMap.get(row.guild_id);
    if (g) map.set(row.member_id, g);
  }
  return map;
}
