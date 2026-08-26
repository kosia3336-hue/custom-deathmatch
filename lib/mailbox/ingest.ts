import type { GuildV4UnseenPayout } from '@/lib/guild-v4/types';
import type { GuildScoutMail, TitleGrantedMail } from '@/lib/mailbox/types';
import { useMailboxStore } from '@/stores/mailbox';

/** 소켓·정산 직후 DB 목록을 다시 맞춘다. 클라에 편지를 만들지 않는다. */
function refreshMailbox(): void {
  void useMailboxStore.getState().refresh();
}

export function ingestTitleGrantedMail(_payload: TitleGrantedMail): void {
  refreshMailbox();
}

export function ingestNoticePublishedMail(_payload: {
  noticeId: string;
  title: string;
  category: string;
}): void {
  refreshMailbox();
}

export function ingestGuildRankPayoutMail(_p: GuildV4UnseenPayout): void {
  refreshMailbox();
}

export function ingestGuildScoutMail(_payload: GuildScoutMail): void {
  refreshMailbox();
}
