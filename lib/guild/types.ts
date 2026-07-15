/** 길드 시스템 공통 타입/상수. */

export const GUILD_INITIAL_CAPACITY = 3;
export const GUILD_MAX_CAPACITY = 30;
/** 길드원 추가 모집권 가격 (길드 포인트) */
export const GUILD_EXPANSION_COST_GP = 500;
/** 길드 창설권 가격 (CDP) — db/guilds.sql 의 shop_items 와 동일해야 함 */
export const GUILD_CHARTER_PRICE_CDP = 1500;

/** 랭크 게임 길드 포인트 적립량 */
export const GUILD_POINTS = { rankWin: 10, rankDraw: 5, rankLoss: 4 } as const;

export interface GuildSummary {
  id: string;
  name: string;
  description: string;
  ownerNickname: string;
  capacity: number;
  memberCount: number;
  points: number;
  createdAt: string;
}

export interface GuildMemberInfo {
  memberId: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface GuildJoinRequestInfo {
  id: string;
  guildId: string;
  guildName?: string;
  memberId: string;
  nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled';
  createdAt: string;
}

export interface MyGuildState {
  guild: GuildSummary | null;
  role: 'owner' | 'member' | null;
  members: GuildMemberInfo[];
  /** 길드장인 경우: 대기 중 가입 신청 */
  pendingRequests: GuildJoinRequestInfo[];
  /** 내가 보낸 pending 신청 (미가입 상태) */
  myRequest: GuildJoinRequestInfo | null;
  /** 창설권 보유 수 */
  charterCount: number;
}
