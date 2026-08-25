import type { GuildV4UnseenPayout } from '@/lib/guild-v4/types';
import {
  useMailboxStore,
  type GuildScoutMail,
  type MailDraft,
  type MailItem,
  type TitleGrantedMail,
} from '@/stores/mailbox';

export type MailIngestResult = {
  item: MailItem;
  created: boolean;
};

function commitMail(draft: MailDraft): MailIngestResult | null {
  const store = useMailboxStore.getState();
  store.hydrate();
  const id = draft.id?.trim();
  const existing = id ? store.items.find((m) => m.id === id) : undefined;
  const item = store.addMail(draft);
  if (!item) return null;
  return { item, created: !existing };
}

/** 예전 TitleGrantedModal 내용 그대로. 문구를 새로 쓰지 않는다. */
export function ingestTitleGrantedMail(payload: TitleGrantedMail): MailIngestResult | null {
  const desc = payload.description?.trim() || null;
  return commitMail({
    id: `title:${payload.titleId}`,
    kind: 'title',
    sender: '시스템',
    title: '칭호 획득!',
    body: desc || payload.name,
    titleGrant: {
      titleId: payload.titleId,
      name: payload.name,
      color: payload.color,
      description: desc,
      effect: payload.effect,
    },
  });
}

const NOTICE_CATEGORY_LABELS: Record<string, string> = {
  general: '일반',
  maintenance: '점검',
  update: '업데이트',
  event: '이벤트',
  urgent: '긴급',
};

/** 예전 notice:published 토스트와 같은 우편. */
export function ingestNoticePublishedMail(payload: {
  noticeId: string;
  title: string;
  category: string;
}): MailIngestResult | null {
  const categoryLabel = NOTICE_CATEGORY_LABELS[payload.category] ?? payload.category;
  return commitMail({
    id: `notice:${payload.noticeId}`,
    kind: 'notice',
    sender: '운영팀',
    title: `새 공지 [${categoryLabel}]`,
    body: payload.title,
  });
}

/** 길드 주간·월간 보상 안내. GP는 길드 획득. */
export function ingestGuildRankPayoutMail(p: GuildV4UnseenPayout): MailIngestResult | null {
  const weekly = p.kind === 'weekly';
  const lines: string[] = [];
  if (p.gp > 0) {
    lines.push(`길드 +${p.gp.toLocaleString('ko-KR')}GP 획득.`);
  }
  if (p.tickets > 0) {
    lines.push(`길드원 전원 뽑기권 ${p.tickets}개 획득.`);
  }
  if (p.titleGranted) {
    lines.push(`길드원 전원 칭호 「${p.guildName}」 획득.`);
  }
  if (lines.length === 0) {
    lines.push('이번 정산에서 받은 보상은 없습니다.');
  }

  const draft: MailDraft = {
    id: `guild-payout:${p.kind}:${p.periodKey}`,
    kind: 'guild',
    sender: '길드',
    title: weekly ? '주간 길드 보상 획득' : '월간 길드 보상 획득',
    body: lines.join('\n'),
  };
  return commitMail(draft);
}

export function ingestGuildScoutMail(payload: GuildScoutMail): MailIngestResult | null {
  return commitMail({
    id: `guild-scout:${payload.inviteId}`,
    kind: 'guild',
    sender: payload.fromNickname || payload.guildName,
    title: '길드 스카우트 초대',
    body: `${payload.guildName} 길드에서 스카우트 초대가 왔습니다.`,
    scoutInvite: payload,
  });
}
