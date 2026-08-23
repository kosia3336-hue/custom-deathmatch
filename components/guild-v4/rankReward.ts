/** 길드 랭킹 주간·월간 보상. `/dev` 인메모리만. 운영 칭호·재화 테이블은 안 건드린다. */

import type { DisplayedTitle } from '@/shared/types/room';
import type { GuildMemberInfo, GuildSummary, MyGuildState } from '@/lib/guild/types';
import { assignGuildRanks, type DevGuildRankPeriod, type DevGuildRankScores } from './rankScore';
import { guildRankPeriodAnchor } from '@shared/rank/kst';

export const WEEKLY_RANK_GP = [200, 100, 50] as const;
export const MONTHLY_RANK_GP = [500, 300, 100] as const;
export const WEEKLY_RANK_TICKETS = [2, 1, 1] as const;
export const MONTHLY_RANK_TICKETS = [3, 2, 1] as const;

const CHAMP_PREFIX = 'dev-champ-';

export type DevChampHold = {
  guildId: string;
  guildName: string;
  memberIds: string[];
};

export type DevRankChamp = {
  monthly: DevChampHold[];
};

export const EMPTY_DEV_CHAMP: DevRankChamp = { monthly: [] };

export function champTitleId(guildId: string): string {
  return `${CHAMP_PREFIX}monthly-${guildId}`;
}

/** 월간 1위 일반 칭호. 이름은 길드명. */
export const GUILD_MONTHLY_TITLE_META = {
  description: '지난 달 길드 랭킹 길드원들',
  conditionText: '지난 달 길드 랭킹 1위 길드원',
  color: 'gold' as const,
  effect: null,
  isSystem: false,
  isLegend: false,
};

export function makeChampTitle(guildId: string, guildName: string): DisplayedTitle {
  return {
    id: champTitleId(guildId),
    name: guildName,
    color: GUILD_MONTHLY_TITLE_META.color,
    effect: GUILD_MONTHLY_TITLE_META.effect,
  };
}

/** KST 그 주 월요일 `w:YYYY-MM-DD`. 기간은 랭크 종료 01:00에 넘어간다. */
export function weeklyPeriodKey(now = new Date()): string {
  const [y, m, d] = guildRankPeriodAnchor(now)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    .split('-')
    .map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const wd = new Date(utc).getUTCDay();
  const offset = wd === 0 ? -6 : 1 - wd;
  const mon = new Date(utc);
  mon.setUTCDate(mon.getUTCDate() + offset);
  const ys = mon.getUTCFullYear();
  const ms = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const ds = String(mon.getUTCDate()).padStart(2, '0');
  return `w:${ys}-${ms}-${ds}`;
}

/** KST `m:YYYY-MM`. 기간은 랭크 종료 01:00에 넘어간다. */
export function monthlyPeriodKey(now = new Date()): string {
  const [y, mo] = guildRankPeriodAnchor(now)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    .split('-');
  return `m:${y}-${mo}`;
}

function placeIndex(rank: number): 0 | 1 | 2 | null {
  if (rank === 1) return 0;
  if (rank === 2) return 1;
  if (rank === 3) return 2;
  return null;
}

function gpTable(period: DevGuildRankPeriod) {
  return period === 'weekly' ? WEEKLY_RANK_GP : MONTHLY_RANK_GP;
}

function ticketTable(period: DevGuildRankPeriod) {
  return period === 'weekly' ? WEEKLY_RANK_TICKETS : MONTHLY_RANK_TICKETS;
}

function membersByGuild(my: MyGuildState): Record<string, GuildMemberInfo[]> {
  if (!my.guild) return {};
  return { [my.guild.id]: my.members };
}

function syncMy(guilds: GuildSummary[], my: MyGuildState): MyGuildState {
  if (!my.guild) return my;
  const g = guilds.find((x) => x.id === my.guild!.id);
  return g ? { ...my, guild: g } : my;
}

export function titlesFromChamp(
  baseTitles: Record<string, DisplayedTitle | null>,
  champ: DevRankChamp,
): Record<string, DisplayedTitle | null> {
  const titles: Record<string, DisplayedTitle | null> = { ...baseTitles };
  for (const hold of champ.monthly) {
    const title = makeChampTitle(hold.guildId, hold.guildName);
    for (const id of hold.memberIds) titles[id] = title;
  }
  return titles;
}

export function removeChampMember(champ: DevRankChamp, memberId: string): DevRankChamp {
  return {
    monthly: champ.monthly.map((h) => ({
      ...h,
      memberIds: h.memberIds.filter((id) => id !== memberId),
    })),
  };
}

export function dropChampGuild(champ: DevRankChamp, guildId: string): DevRankChamp {
  return {
    monthly: champ.monthly.filter((h) => h.guildId !== guildId),
  };
}

function settleOne(
  guilds: GuildSummary[],
  scores: Record<string, number>,
  roster: Record<string, GuildMemberInfo[]>,
  period: DevGuildRankPeriod,
  tickets: Record<string, number>,
): { guilds: GuildSummary[]; holds: DevChampHold[]; tickets: Record<string, number> } {
  const nextGuilds = guilds.map((g) => ({ ...g }));
  const nextTickets = { ...tickets };
  const ranks = assignGuildRanks(nextGuilds, scores);
  const gp = gpTable(period);
  const tk = ticketTable(period);

  for (const g of nextGuilds) {
    const idx = placeIndex(ranks.get(g.id) ?? 0);
    if (idx === null) continue;
    g.points += gp[idx];
    for (const m of roster[g.id] ?? []) {
      nextTickets[m.memberId] = (nextTickets[m.memberId] ?? 0) + tk[idx];
    }
  }

  const holds: DevChampHold[] = nextGuilds
    .filter((g) => ranks.get(g.id) === 1)
    .map((g) => ({
      guildId: g.id,
      guildName: g.name,
      memberIds: (roster[g.id] ?? []).map((m) => m.memberId),
    }));

  return { guilds: nextGuilds, holds, tickets: nextTickets };
}

export type RankRewardSnapshot = {
  guilds: GuildSummary[];
  my: MyGuildState;
  rankScores: Record<string, DevGuildRankScores>;
  baseTitles: Record<string, DisplayedTitle | null>;
  champ: DevRankChamp;
  gachaTickets: Record<string, number>;
  weeklySettledKey: string;
  monthlySettledKey: string;
};

export function applyRankSettlements(
  snap: RankRewardSnapshot,
  now = new Date(),
): RankRewardSnapshot & { titles: Record<string, DisplayedTitle | null> } {
  const wKey = weeklyPeriodKey(now);
  const mKey = monthlyPeriodKey(now);
  const roster = membersByGuild(snap.my);
  let { guilds, champ, gachaTickets, weeklySettledKey, monthlySettledKey } = snap;

  if (weeklySettledKey !== wKey) {
    const scores: Record<string, number> = {};
    for (const g of guilds) scores[g.id] = snap.rankScores[g.id]?.weekly ?? 0;
    const out = settleOne(guilds, scores, roster, 'weekly', gachaTickets);
    guilds = out.guilds;
    gachaTickets = out.tickets;
    weeklySettledKey = wKey;
  }

  if (monthlySettledKey !== mKey) {
    const scores: Record<string, number> = {};
    for (const g of guilds) scores[g.id] = snap.rankScores[g.id]?.monthly ?? 0;
    const out = settleOne(guilds, scores, roster, 'monthly', gachaTickets);
    guilds = out.guilds;
    gachaTickets = out.tickets;
    champ = { ...champ, monthly: out.holds };
    monthlySettledKey = mKey;
  }

  const my = syncMy(guilds, snap.my);
  return {
    ...snap,
    guilds,
    my,
    champ,
    gachaTickets,
    weeklySettledKey,
    monthlySettledKey,
    titles: titlesFromChamp(snap.baseTitles, champ),
  };
}
