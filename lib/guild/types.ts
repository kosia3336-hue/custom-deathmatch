/** 길드 시스템 공통 타입/상수. */

export const GUILD_INITIAL_CAPACITY = 3;
export const GUILD_MAX_CAPACITY = 30;
/** 길드원 추가 모집권 가격 (길드 포인트) */
export const GUILD_EXPANSION_COST_GP = 500;
/** 길드 창설권 가격 (CDP) — db/guilds.sql 의 shop_items 와 동일해야 함 */
export const GUILD_CHARTER_PRICE_CDP = 1500;

/** 랭크 게임 길드 포인트 적립량 */
export const GUILD_POINTS = { rankWin: 10, rankDraw: 5, rankLoss: 4 } as const;

/** 길드 마크 등록·변경 가격 (길드 포인트) */
export const GUILD_MARK_COST_GP = 300;
/** 길드 마크 이미지 제한 */
export const GUILD_MARK_MAX_BYTES = 512 * 1024; // 512KB
export const GUILD_MARK_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** CDP 수완 버프 최대 레벨 (레벨당 CDP +1%) */
export const GUILD_BUFF_MAX_LEVEL = 9;
/** 다음 레벨(현재 level → level+1) 승급 비용: 100 × 2^level */
export function guildBuffCost(currentLevel: number): number {
  return 100 * 2 ** currentLevel;
}
/** 버프 레벨 → CDP 배수 (레벨당 +1%) */
export function guildBuffMultiplier(level: number): number {
  return 1 + Math.max(0, Math.min(GUILD_BUFF_MAX_LEVEL, level)) * 0.01;
}

export interface GuildSummary {
  id: string;
  name: string;
  description: string;
  ownerNickname: string;
  capacity: number;
  memberCount: number;
  points: number;
  createdAt: string;
  /** 길드 마크 이미지 URL (미등록 시 null) */
  markUrl: string | null;
  /** CDP 수완 버프 레벨 (0~9) */
  buffCdpLevel: number;
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
