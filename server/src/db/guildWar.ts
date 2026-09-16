/**
 * 길드전 공유 칩 DB 헬퍼.
 * 기존 길드 RPC 16개는 건드리지 않는다. `db/guild_war_chips.sql` 의 새 RPC만 쓴다.
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

export interface GuildWarContext {
  guildId: string;
  guildName: string;
  guildMarkUrl: string;
  balance: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 회원의 활성 길드 + 공유 칩 잔액. 무소속이면 null. */
export async function getGuildWarContext(memberId: string): Promise<GuildWarContext | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  try {
    const { data: memberRow, error: memberErr } = await (sb as any)
      .from('guild_members')
      .select('guild_id')
      .eq('member_id', memberId)
      .maybeSingle();
    if (memberErr) {
      console.warn('[guildWar] guild_members 조회 실패:', memberErr.message);
      return null;
    }
    const guildId = (memberRow as { guild_id?: string } | null)?.guild_id;
    if (!guildId) return null;

    const { data: guildRow } = await (sb as any)
      .from('guilds')
      .select('id, name, mark_url, disbanded_at')
      .eq('id', guildId)
      .maybeSingle();
    const guild = guildRow as
      | { id: string; name: string; mark_url: string | null; disbanded_at: string | null }
      | null;
    if (!guild || guild.disbanded_at) return null;

    return {
      guildId: guild.id,
      guildName: guild.name,
      guildMarkUrl: guild.mark_url ?? '',
      balance: await getGuildWarBalance(guildId),
    };
  } catch (err) {
    console.warn('[guildWar] 컨텍스트 예외:', (err as Error).message);
    return null;
  }
}

export async function getGuildWarBalance(guildId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('guild_war_chips')
      .select('balance')
      .eq('guild_id', guildId)
      .maybeSingle();
    return Number((data as { balance?: number } | null)?.balance ?? 0);
  } catch {
    return 0;
  }
}

export async function getGuildWarBalances(guildIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (guildIds.length === 0 || !isSupabaseConfigured()) return out;
  const sb = getSupabaseAdmin();
  try {
    const { data } = await (sb as any)
      .from('guild_war_chips')
      .select('guild_id, balance')
      .in('guild_id', guildIds);
    for (const row of (data ?? []) as Array<{ guild_id: string; balance: number }>) {
      out.set(row.guild_id, Number(row.balance ?? 0));
    }
  } catch (err) {
    console.warn('[guildWar] 잔액 일괄 조회 실패:', (err as Error).message);
  }
  for (const id of guildIds) if (!out.has(id)) out.set(id, 0);
  return out;
}

/** 세트 1회 정산. 길드 단위 델타. 반환 = 정산 후 잔액. */
export async function settleGuildWarSet(
  setId: string,
  entries: Array<{ guildId: string; delta: number }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const payload = entries
    .filter((e) => e.delta !== 0)
    .map((e) => ({ guild_id: e.guildId, delta: Math.trunc(e.delta) }));
  if (payload.length === 0 || !isSupabaseConfigured()) return out;

  const sb = getSupabaseAdmin();
  const { data, error } = await (sb.rpc as any)('settle_guild_war_set', {
    p_set_id: setId,
    p_entries: payload,
  });
  if (error) {
    console.error('[guildWar] settle_guild_war_set 실패:', error.message);
    throw new Error(`settle_guild_war_set: ${error.message}`);
  }
  for (const row of (Array.isArray(data) ? data : []) as Array<{
    guild_id: string;
    new_balance: number;
  }>) {
    out.set(row.guild_id, Number(row.new_balance ?? 0));
  }
  return out;
}

/** 기간 종료 자동 환전 (칩당 8 GP). 이미 0이면 아무것도 안 한다. */
export async function expireGuildWarChips(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb.rpc as any)('expire_guild_war_chips', {});
  if (error) {
    console.error('[guildWar] expire_guild_war_chips 실패:', error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}
