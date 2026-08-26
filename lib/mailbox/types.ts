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
}
