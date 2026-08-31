export type MailKind = 'title' | 'guild' | 'notice' | 'reward' | 'system';

export interface GuildScoutMail {
  inviteId: string;
  guildId: string;
  guildName: string;
  fromNickname: string;
  targetHadGuild: boolean;
  targetGuildName: string | null;
}

export interface TitleGrantedMail {
  titleId: string;
  name: string;
  color: string;
  description: string | null;
  effect?: string | null;
}

/** 편지에 매달린 보상. 지금은 CDP 만 쓴다. */
export interface MailReward {
  cdp: number;
}

export interface MailItem {
  id: string;
  kind: MailKind;
  title: string;
  body: string;
  sender: string;
  createdAt: number;
  readAt: number | null;
  titleGrant?: TitleGrantedMail;
  scoutInvite?: GuildScoutMail;
  /** 보상 편지에만 있다. */
  reward?: MailReward;
  /** 보상을 받은 시각. null 이면 아직 안 받았다. */
  claimedAt?: number | null;
}
