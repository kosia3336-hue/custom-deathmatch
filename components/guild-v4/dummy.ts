import type { DisplayedTitle } from '@/shared/types/room';
import type {
  GuildV4ContribScores,
  GuildV4GrantLog,
  GuildV4InvestLog,
  GuildV4Notice,
  GuildV4NoticeComment,
  GuildV4Sponsor,
} from '@/lib/guild-v4/types';

export type DevGuildMe = {
  id: string;
  nickname: string;
  displayedTitle?: DisplayedTitle | null;
  cdpBalance?: number;
};

export type DevGuildNoticeComment = GuildV4NoticeComment;
export type DevGuildNotice = GuildV4Notice;
export type DevGuildContribPeriod = 'daily' | 'weekly' | 'all';
export type DevGuildContribScores = GuildV4ContribScores;
export const EMPTY_DEV_CONTRIB: DevGuildContribScores = { daily: 0, weekly: 0, all: 0 };
export type DevGuildSponsor = GuildV4Sponsor;
export const EMPTY_DEV_SPONSOR: DevGuildSponsor = { cdp: 0, gp: 0 };
export type DevGuildInvestLog = GuildV4InvestLog;
export type DevGuildGrantLog = GuildV4GrantLog;
