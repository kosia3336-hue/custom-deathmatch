export const GUILD_SCOUT_COST_GP = 50;

export type GuildScoutTarget = {
  memberId: string;
  nickname: string;
  hasGuild: boolean;
  guildName: string | null;
  alreadyInvited: boolean;
};

export type GuildScoutInvitePayload = {
  inviteId: string;
  guildId: string;
  guildName: string;
  fromNickname: string;
  targetHadGuild: boolean;
  targetGuildName: string | null;
};
