import 'server-only';

import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import { loadResolvedDisplayedTitles } from '@shared/titles/resolve-displayed';
import { getMyGuildState } from '@/lib/guild/server';
import type { GuildSummary } from '@/lib/guild/types';
import { guildRankSizeDivisor } from '@/components/guild-v4/rankScore';
import { DEV_DEFAULT_TILE_ORDER, normalizeTileOrder } from '@/components/guild-v4/tiles';
import { guildContribDailyRange, guildRankPeriodAnchor, isGuildRankSettleHourKst } from '@shared/rank/kst';
import type {
  GuildV4ContribScores,
  GuildV4GrantLog,
  GuildV4InvestLog,
  GuildV4Notice,
  GuildV4RankScores,
  GuildV4Snapshot,
  GuildV4Sponsor,
  GuildV4UnseenPayout,
} from './types';
import { parseRankCardShopSkinId, type RankCardShopSkinId } from '@shared/rank-card-skins';
import { formatGuildRankPeriodLabel } from './payoutFormat';

type Sb = ReturnType<typeof getSupabaseServiceRole>;

function from(sb: Sb, table: string) {
  return (sb as unknown as { from: (t: string) => ReturnType<Sb['from']> }).from(table);
}

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rpcOf(sb: Sb): Rpc {
  return sb.rpc.bind(sb) as unknown as Rpc;
}

interface GuildRow {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  capacity: number;
  points: number;
  created_at: string;
  mark_url: string | null;
  buff_cdp_level: number | null;
}

async function fetchNicknames(sb: Sb, memberIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(memberIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await sb.from('members').select('id, nickname').in('id', ids);
  for (const r of (data ?? []) as { id: string; nickname: string }[]) map.set(r.id, r.nickname);
  return map;
}

async function listActiveGuilds(sb: Sb): Promise<GuildSummary[]> {
  const { data: guilds } = await sb.from('guilds').select('*').is('disbanded_at', null).limit(200);
  const rows = (guilds ?? []) as GuildRow[];
  if (rows.length === 0) return [];

  const { data: membersData } = await sb
    .from('guild_members')
    .select('guild_id, member_id, role, joined_at')
    .in(
      'guild_id',
      rows.map((g) => g.id),
    );
  const memberRows = (membersData ?? []) as { guild_id: string }[];
  const nicknames = await fetchNicknames(
    sb,
    rows.map((g) => g.owner_id),
  );

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    ownerNickname: nicknames.get(g.owner_id) ?? '',
    capacity: g.capacity,
    memberCount: memberRows.filter((m) => m.guild_id === g.id).length,
    points: Number(g.points),
    createdAt: g.created_at,
    markUrl: g.mark_url ?? null,
    buffCdpLevel: Number(g.buff_cdp_level ?? 0),
  }));
}

export async function loadActiveGuildSummary(guildId: string): Promise<GuildSummary | null> {
  if (!guildId) return null;
  const sb = getSupabaseServiceRole();
  const guilds = await listActiveGuilds(sb);
  return guilds.find((g) => g.id === guildId) ?? null;
}

function seoulYmd(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const dow = new Date(utc).getUTCDay();
  const iso = dow === 0 ? 7 : dow;
  return addDaysYmd(ymd, -(iso - 1));
}

async function currentPeriodKeys(sb: Sb): Promise<{ weekly: string; monthly: string }> {
  const { data, error } = await rpcOf(sb)('guild_v4_period_keys');
  if (!error && data) {
    const row = (Array.isArray(data) ? data[0] : data) as { weekly?: string; monthly?: string } | null;
    if (row?.weekly && row?.monthly) return { weekly: row.weekly, monthly: row.monthly };
  }
  const today = seoulYmd(guildRankPeriodAnchor());
  return { weekly: `w:${mondayOf(today)}`, monthly: `m:${today.slice(0, 7)}` };
}

async function settleDueGuildRanks(sb: Sb): Promise<void> {
  if (!isGuildRankSettleHourKst()) return;
  const { error } = await rpcOf(sb)('settle_due_guild_ranks_v4', {});
  if (error) console.warn('[guild2:settle] 실패(무시):', error.message);
}

async function loadNotices(sb: Sb, guildId: string): Promise<GuildV4Notice[]> {
  const { data: noticeRows } = await from(sb, 'guild_notices')
    .select('id, author_id, title, body, created_at, updated_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(50);
  const notices = (noticeRows ?? []) as {
    id: string;
    author_id: string;
    title: string;
    body: string;
    created_at: string;
    updated_at: string | null;
  }[];
  if (notices.length === 0) return [];

  const { data: commentRows } = await from(sb, 'guild_notice_comments')
    .select('id, notice_id, author_id, body, created_at')
    .in(
      'notice_id',
      notices.map((n) => n.id),
    )
    .order('created_at', { ascending: true });
  const comments = (commentRows ?? []) as {
    id: string;
    notice_id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[];

  const nicknames = await fetchNicknames(sb, [
    ...notices.map((n) => n.author_id),
    ...comments.map((c) => c.author_id),
  ]);

  return notices.map((n) => ({
    id: n.id,
    authorId: n.author_id,
    authorNickname: nicknames.get(n.author_id) ?? '',
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    updatedAt: n.updated_at ?? null,
    comments: comments
      .filter((c) => c.notice_id === n.id)
      .map((c) => ({
        id: c.id,
        authorId: c.author_id,
        authorNickname: nicknames.get(c.author_id) ?? '',
        body: c.body,
        createdAt: c.created_at,
      })),
  }));
}

function emptyContrib(): GuildV4ContribScores {
  return { daily: 0, weekly: 0, all: 0 };
}

/** 길드 랭킹 점수 적립이 시작된 주(w:2026-08-24) 01:00 KST. 그 전 경기는 점수에 안 들어갔다. */
const GUILD_RANK_SCORE_SINCE = '2026-08-24T01:00:00+09:00';

type RankRosterRow = {
  memberId: string;
  guildId: string;
  joinedAt: string;
};

async function loadMemberRankScores(
  sb: Sb,
  roster: RankRosterRow[],
): Promise<Record<string, GuildV4ContribScores>> {
  const out: Record<string, GuildV4ContribScores> = {};
  const joinedAt = new Map<string, number>();
  const guildOf = new Map<string, string>();
  const byGuild = new Map<string, RankRosterRow[]>();
  for (const m of roster) {
    out[m.memberId] = emptyContrib();
    joinedAt.set(m.memberId, Date.parse(m.joinedAt));
    guildOf.set(m.memberId, m.guildId);
    const list = byGuild.get(m.guildId) ?? [];
    list.push(m);
    byGuild.set(m.guildId, list);
  }
  if (roster.length === 0) return out;

  const memberIds = roster.map((m) => m.memberId);
  const guildIds = [...byGuild.keys()];
  const [winRes, lossRes, drawRes] = await Promise.all([
    sb
      .from('rank_match_history')
      .select('winner_id, winner_rp_gain, played_at')
      .in('winner_id', memberIds)
      .gte('played_at', GUILD_RANK_SCORE_SINCE)
      .limit(5000),
    sb
      .from('rank_match_history')
      .select('loser_id, loser_rp_loss, played_at')
      .in('loser_id', memberIds)
      .gte('played_at', GUILD_RANK_SCORE_SINCE)
      .limit(5000),
    sb
      .from('guild_point_ledger')
      .select('member_id, created_at')
      .in('guild_id', guildIds)
      .eq('reason', 'rank_draw')
      .gte('created_at', GUILD_RANK_SCORE_SINCE)
      .limit(5000),
  ]);

  const today = seoulYmd();
  const weekStart = mondayOf(today);
  const { start: dailyStart, end: dailyEnd } = guildContribDailyRange();
  const dailyStartMs = dailyStart.getTime();
  const dailyEndMs = dailyEnd.getTime();
  const weekStartMs = Date.parse(`${weekStart}T00:00:00+09:00`);

  const nAt = (guildId: string, t: number) => {
    let n = 0;
    for (const m of byGuild.get(guildId) ?? []) {
      if (Date.parse(m.joinedAt) <= t) n += 1;
    }
    return n;
  };

  const add = (memberId: string, material: number, at: string) => {
    const slot = out[memberId];
    const guildId = guildOf.get(memberId);
    if (!slot || !guildId || material <= 0) return;
    const t = Date.parse(at);
    const joined = joinedAt.get(memberId);
    if (!Number.isFinite(t) || joined == null || t < joined) return;
    const score = material / guildRankSizeDivisor(nAt(guildId, t), t);
    if (score <= 0) return;
    slot.all += score;
    if (t >= weekStartMs) slot.weekly += score;
    if (t >= dailyStartMs && t < dailyEndMs) slot.daily += score;
  };

  for (const row of (winRes.data ?? []) as {
    winner_id: string;
    winner_rp_gain: number;
    played_at: string;
  }[]) {
    add(row.winner_id, Math.max(0, Math.round(Number(row.winner_rp_gain))), row.played_at);
  }
  for (const row of (lossRes.data ?? []) as {
    loser_id: string;
    loser_rp_loss: number;
    played_at: string;
  }[]) {
    const loss = Number(row.loser_rp_loss);
    if (loss <= 0) continue;
    add(row.loser_id, Math.max(1, Math.round(loss * 0.2)), row.played_at);
  }
  for (const row of (drawRes.data ?? []) as {
    member_id: string | null;
    created_at: string;
  }[]) {
    if (!row.member_id) continue;
    add(row.member_id, 5, row.created_at);
  }
  return out;
}

async function loadInvest(
  sb: Sb,
  guildId: string,
  memberIds: string[],
): Promise<{
  sponsors: Record<string, GuildV4Sponsor>;
  logs: GuildV4InvestLog[];
}> {
  const sponsors: Record<string, GuildV4Sponsor> = {};
  for (const id of memberIds) sponsors[id] = { cdp: 0, gp: 0 };

  const { data } = await from(sb, 'guild_invest_ledger')
    .select('id, member_id, cdp, gp, created_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    member_id: string;
    cdp: number;
    gp: number;
    created_at: string;
  }[];
  const nicknames = await fetchNicknames(
    sb,
    rows.map((r) => r.member_id),
  );

  for (const r of rows) {
    const s = sponsors[r.member_id] ?? { cdp: 0, gp: 0 };
    s.cdp += r.cdp;
    s.gp += r.gp;
    sponsors[r.member_id] = s;
  }

  const logs: GuildV4InvestLog[] = rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    nickname: nicknames.get(r.member_id) ?? '',
    cdp: r.cdp,
    gp: r.gp,
    createdAt: r.created_at,
  }));
  return { sponsors, logs };
}

async function loadGrants(sb: Sb, guildId: string): Promise<GuildV4GrantLog[]> {
  const { data } = await from(sb, 'guild_grant_ledger')
    .select('id, from_member, to_member, amount, created_at')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    from_member: string;
    to_member: string;
    amount: number;
    created_at: string;
  }[];
  const nicknames = await fetchNicknames(
    sb,
    rows.flatMap((r) => [r.from_member, r.to_member]),
  );
  return rows.map((r) => ({
    id: r.id,
    fromMemberId: r.from_member,
    fromNickname: nicknames.get(r.from_member) ?? '',
    toMemberId: r.to_member,
    toNickname: nicknames.get(r.to_member) ?? '',
    amount: r.amount,
    createdAt: r.created_at,
  }));
}

async function loadRankScores(
  sb: Sb,
  guildIds: string[],
  weekly: string,
  monthly: string,
): Promise<Record<string, GuildV4RankScores>> {
  const out: Record<string, GuildV4RankScores> = {};
  for (const id of guildIds) out[id] = { weekly: 0, monthly: 0 };
  if (guildIds.length === 0) return out;

  const { data } = await from(sb, 'guild_rank_scores')
    .select('guild_id, period_kind, period_key, score')
    .in('guild_id', guildIds)
    .in('period_key', [weekly, monthly]);
  for (const row of (data ?? []) as {
    guild_id: string;
    period_kind: string;
    period_key: string;
    score: number;
  }[]) {
    const slot = out[row.guild_id] ?? { weekly: 0, monthly: 0 };
    if (row.period_key === weekly) slot.weekly = Number(row.score);
    if (row.period_key === monthly) slot.monthly = Number(row.score);
    out[row.guild_id] = slot;
  }
  return out;
}

async function loadActiveRankCard(
  sb: Sb,
  guildId: string,
): Promise<GuildV4Snapshot['rankCard']> {
  const { data } = await from(sb, 'guild_rank_card_skins')
    .select('skin_id, expires_at')
    .eq('guild_id', guildId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  const row = data as { skin_id?: string; expires_at?: string } | null;
  const skinId = parseRankCardShopSkinId(row?.skin_id ?? null);
  if (!skinId || !row?.expires_at) return null;
  return { skinId, expiresAt: row.expires_at };
}

async function loadActiveRankCardsByGuild(
  sb: Sb,
  guildIds: string[],
): Promise<Record<string, RankCardShopSkinId>> {
  const out: Record<string, RankCardShopSkinId> = {};
  if (guildIds.length === 0) return out;
  const { data } = await from(sb, 'guild_rank_card_skins')
    .select('guild_id, skin_id')
    .in('guild_id', guildIds)
    .gt('expires_at', new Date().toISOString());
  for (const row of (data ?? []) as { guild_id: string; skin_id: string }[]) {
    const id = parseRankCardShopSkinId(row.skin_id);
    if (id) out[row.guild_id] = id;
  }
  return out;
}

export async function loadGuildV4Snapshot(memberId: string, nickname: string): Promise<GuildV4Snapshot> {
  const sb = getSupabaseServiceRole();
  const keys = await currentPeriodKeys(sb);
  await settleDueGuildRanks(sb);

  const [guilds, my, cdpRow] = await Promise.all([
    listActiveGuilds(sb),
    getMyGuildState(memberId),
    sb.from('member_cdp').select('balance').eq('member_id', memberId).maybeSingle(),
  ]);
  const myCdp = Number((cdpRow.data as { balance?: number } | null)?.balance ?? 0);
  const guildIds = guilds.map((g) => g.id);
  const [rankScores, rankCards] = await Promise.all([
    loadRankScores(sb, guildIds, keys.weekly, keys.monthly),
    loadActiveRankCardsByGuild(sb, guildIds),
  ]);

  const empty: GuildV4Snapshot = {
    meId: memberId,
    meNickname: nickname,
    guilds,
    my,
    notices: [],
    contribs: {},
    titles: {},
    sponsors: {},
    investLogs: [],
    grantLogs: [],
    rankScores,
    myCdp,
    tileOrder: [...DEV_DEFAULT_TILE_ORDER],
    rankCards,
    rankCard: null,
    chatSeenMessageId: null,
    warChips: 0,
  };

  if (!my.guild) return empty;

  const guildId = my.guild.id;
  const memberIds = my.members.map((m) => m.memberId);
  const roster: RankRosterRow[] = my.members.map((m) => ({
    memberId: m.memberId,
    guildId,
    joinedAt: m.joinedAt,
  }));
  const allContribs = await loadMemberRankScores(sb, roster);
  const { data: layoutRow } = await from(sb, 'guild_menu_layout')
    .select('tile_order')
    .eq('guild_id', guildId)
    .maybeSingle();
  const tileOrder = normalizeTileOrder((layoutRow as { tile_order?: unknown } | null)?.tile_order);

  const { data: titleRows } = await sb
    .from('members')
    .select('id, displayed_title_id, displayed_effect_id')
    .in('id', memberIds);
  const titleMap = await loadResolvedDisplayedTitles(
    sb,
    (titleRows ?? []) as Array<{
      id: string;
      displayed_title_id: string | null;
      displayed_effect_id: string | null;
    }>,
  );
  const titles: GuildV4Snapshot['titles'] = {};
  for (const id of memberIds) {
    const t = titleMap.get(id);
    titles[id] = t ? { id: t.id, name: t.name, color: t.color, effect: t.effect } : null;
  }

  const contribs: Record<string, GuildV4ContribScores> = {};
  for (const id of memberIds) contribs[id] = allContribs[id] ?? emptyContrib();

  const [notices, invest, grantLogs, rankCard, seenRow, chipRow] = await Promise.all([
    loadNotices(sb, guildId),
    loadInvest(sb, guildId, memberIds),
    loadGrants(sb, guildId),
    loadActiveRankCard(sb, guildId),
    from(sb, 'guild_chat_seen_v4')
      .select('last_message_id')
      .eq('member_id', memberId)
      .eq('guild_id', guildId)
      .maybeSingle(),
    from(sb, 'guild_war_chips').select('balance').eq('guild_id', guildId).maybeSingle(),
  ]);
  const chatSeenMessageId =
    (seenRow.data as { last_message_id?: string } | null)?.last_message_id ?? null;
  if (chipRow.error) console.warn('[guild2] guild_war_chips', chipRow.error.message);
  const warChips = chipRow.error
    ? 0
    : Number((chipRow.data as { balance?: number } | null)?.balance ?? 0);

  return {
    ...empty,
    notices,
    contribs,
    titles,
    sponsors: invest.sponsors,
    investLogs: invest.logs,
    grantLogs,
    tileOrder,
    rankCard,
    chatSeenMessageId,
    warChips,
  };
}

export async function loadUnseenGuildRankPayouts(memberId: string): Promise<GuildV4UnseenPayout[]> {
  const sb = getSupabaseServiceRole();
  const { data: mem } = await sb
    .from('guild_members')
    .select('guild_id')
    .eq('member_id', memberId)
    .maybeSingle();
  const guildId = (mem as { guild_id: string } | null)?.guild_id;
  if (!guildId) return [];

  const { data: guildRow } = await from(sb, 'guilds').select('name').eq('id', guildId).maybeSingle();
  const guildName = (guildRow as { name?: string } | null)?.name ?? '';

  const { data: payouts } = await from(sb, 'guild_rank_payouts')
    .select('period_kind, period_key, rank, gp, tickets')
    .eq('guild_id', guildId)
    .gte('rank', 1)
    .lte('rank', 3)
    .order('period_key', { ascending: true });

  const rows = (payouts ?? []) as {
    period_kind: string;
    period_key: string;
    rank: number;
    gp: number;
    tickets: number;
  }[];
  if (rows.length === 0) return [];

  const { data: acks } = await from(sb, 'guild_rank_payout_acks')
    .select('period_kind, period_key')
    .eq('member_id', memberId);
  const seen = new Set(
    ((acks ?? []) as { period_kind: string; period_key: string }[]).map(
      (a) => `${a.period_kind}:${a.period_key}`,
    ),
  );

  const out: GuildV4UnseenPayout[] = [];
  for (const p of rows) {
    if (p.period_kind !== 'weekly' && p.period_kind !== 'monthly') continue;
    if (seen.has(`${p.period_kind}:${p.period_key}`)) continue;
    out.push({
      kind: p.period_kind,
      periodKey: p.period_key,
      periodLabel: formatGuildRankPeriodLabel(p.period_kind, p.period_key),
      guildName,
      rank: p.rank,
      gp: p.gp,
      tickets: p.tickets,
      titleGranted: p.period_kind === 'monthly' && p.rank === 1,
    });
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'weekly' ? -1 : 1;
    return a.periodKey.localeCompare(b.periodKey);
  });
  return out;
}

export async function listGuildMemberIds(guildId: string): Promise<string[]> {
  const sb = getSupabaseServiceRole();
  const { data } = await sb.from('guild_members').select('member_id').eq('guild_id', guildId);
  return ((data ?? []) as { member_id: string }[]).map((r) => r.member_id);
}

/** 헤더 배지용. 길드와 마지막으로 읽은 채팅 id만. */
export async function loadGuildChatBadge(memberId: string): Promise<{
  guildId: string | null;
  chatSeenMessageId: string | null;
}> {
  const sb = getSupabaseServiceRole();
  const guildId = await findGuildIdForMember(memberId);
  if (!guildId) return { guildId: null, chatSeenMessageId: null };
  const { data } = await from(sb, 'guild_chat_seen_v4')
    .select('last_message_id')
    .eq('member_id', memberId)
    .eq('guild_id', guildId)
    .maybeSingle();
  const chatSeenMessageId =
    (data as { last_message_id?: string } | null)?.last_message_id ?? null;
  return { guildId, chatSeenMessageId };
}

export async function findGuildIdForMember(memberId: string): Promise<string | null> {
  const sb = getSupabaseServiceRole();
  const { data } = await sb.from('guild_members').select('guild_id').eq('member_id', memberId).maybeSingle();
  return (data as { guild_id: string } | null)?.guild_id ?? null;
}

export function parseCatalogLogoId(markUrl: string): string | null {
  const m = markUrl.match(/\/(?:dev\/)?guild\/logos\/([a-z0-9-]+)\.png/i);
  return m?.[1] ?? null;
}

export { rpcOf };
export type { Rpc };
