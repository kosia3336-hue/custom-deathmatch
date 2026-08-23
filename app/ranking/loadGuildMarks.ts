import 'server-only';
import type { GuildMarkInfo } from '@/components/cdm/GuildMark';

interface MembershipRow {
  member_id: string;
  guild_id: string;
}

interface GuildRow {
  id: string;
  name: string;
  mark_url: string | null;
}

/**
 * 랭킹 페이지에 올라온 회원만 묶어 활성 길드 로고를 읽는다.
 * 로고가 없거나 해체된 길드는 맵에 넣지 않는다 (빈 칸을 만들지 않음).
 */
export async function loadGuildMarksForMembers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  memberIds: string[],
): Promise<Map<string, GuildMarkInfo>> {
  const map = new Map<string, GuildMarkInfo>();
  if (memberIds.length === 0) return map;

  const { data: memberships } = await sb
    .from('guild_members')
    .select('member_id, guild_id')
    .in('member_id', memberIds);
  const rows = (memberships ?? []) as MembershipRow[];
  if (rows.length === 0) return map;

  const guildIds = [...new Set(rows.map((r) => r.guild_id))];
  const { data: guilds } = await sb
    .from('guilds')
    .select('id, name, mark_url')
    .in('id', guildIds)
    .is('disbanded_at', null);
  const guildMap = new Map<string, GuildRow>();
  for (const g of (guilds ?? []) as GuildRow[]) {
    if (g.mark_url) guildMap.set(g.id, g);
  }

  for (const row of rows) {
    const g = guildMap.get(row.guild_id);
    if (!g?.mark_url) continue;
    map.set(row.member_id, { url: g.mark_url, name: g.name });
  }
  return map;
}
