import type { DisplayedTitle } from '@/shared/types/room';
import type { GuildSummary, MyGuildState } from '@/lib/guild/types';
import type { RankCardShopSkinId } from '@shared/rank-card-skins';

export type GuildV4NoticeComment = {
  id: string;
  authorId: string;
  authorNickname: string;
  body: string;
  createdAt: string;
};

export type GuildV4Notice = {
  id: string;
  authorId: string;
  authorNickname: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
  comments: GuildV4NoticeComment[];
};

/** 길드 랭킹에 넣은 점수(점). GP가 아님. */
export type GuildV4ContribScores = {
  daily: number;
  weekly: number;
  all: number;
};

export type GuildV4Sponsor = {
  cdp: number;
  gp: number;
};

export type GuildV4InvestLog = {
  id: string;
  memberId: string;
  nickname: string;
  cdp: number;
  gp: number;
  createdAt: string;
};

export type GuildV4GrantLog = {
  id: string;
  fromMemberId: string;
  fromNickname: string;
  toMemberId: string;
  toNickname: string;
  amount: number;
  createdAt: string;
};

export type GuildV4RankScores = {
  weekly: number;
  monthly: number;
};

export type GuildV4PayoutKind = 'weekly' | 'monthly';

export type GuildV4UnseenPayout = {
  kind: GuildV4PayoutKind;
  periodKey: string;
  periodLabel: string;
  guildName: string;
  rank: number;
  gp: number;
  tickets: number;
  titleGranted: boolean;
};

export type GuildV4Snapshot = {
  meId: string;
  meNickname: string;
  guilds: GuildSummary[];
  my: MyGuildState;
  notices: GuildV4Notice[];
  contribs: Record<string, GuildV4ContribScores>;
  titles: Record<string, DisplayedTitle | null>;
  sponsors: Record<string, GuildV4Sponsor>;
  investLogs: GuildV4InvestLog[];
  grantLogs: GuildV4GrantLog[];
  rankScores: Record<string, GuildV4RankScores>;
  myCdp: number;
  tileOrder: string[];
  /** 활성 길드별 랭킹 카드. 만료된 길드는 없음. */
  rankCards: Record<string, RankCardShopSkinId>;
  /** 내 길드에 켜진 랭킹 카드. 만료되면 null. */
  rankCard: { skinId: RankCardShopSkinId; expiresAt: string } | null;
  /** 마지막으로 읽은 길드 채팅 메시지 id. 없으면 히스토리 전부 안 읽음. */
  chatSeenMessageId: string | null;
};
