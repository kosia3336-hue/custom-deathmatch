import type {
  GuildScoutMail,
  MailItem,
  MailKind,
  MailReward,
  TitleGrantedMail,
} from '@/lib/mailbox/types';

const KINDS: MailKind[] = ['title', 'guild', 'notice', 'reward', 'system'];

export interface MailboxRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  sender: string;
  payload: unknown;
  created_at: string;
  read_at: string | null;
  claimed_at?: string | null;
}

function asKind(v: string): MailKind {
  return KINDS.includes(v as MailKind) ? (v as MailKind) : 'system';
}

function asTitleGrant(raw: unknown): TitleGrantedMail | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = (raw as { titleGrant?: Record<string, unknown> }).titleGrant;
  if (!g || typeof g.titleId !== 'string' || typeof g.name !== 'string') return undefined;
  return {
    titleId: g.titleId,
    name: g.name,
    color: typeof g.color === 'string' ? g.color : 'gray',
    description: typeof g.description === 'string' ? g.description : null,
    effect: typeof g.effect === 'string' ? g.effect : null,
  };
}

function asScout(raw: unknown): GuildScoutMail | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = (raw as { scoutInvite?: Record<string, unknown> }).scoutInvite;
  if (!s || typeof s.inviteId !== 'string' || typeof s.guildId !== 'string') return undefined;
  return {
    inviteId: s.inviteId,
    guildId: s.guildId,
    guildName: typeof s.guildName === 'string' ? s.guildName : '',
    fromNickname: typeof s.fromNickname === 'string' ? s.fromNickname : '',
    targetHadGuild: s.targetHadGuild === true,
    targetGuildName: typeof s.targetGuildName === 'string' ? s.targetGuildName : null,
  };
}

function asReward(raw: unknown): MailReward | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = (raw as { reward?: Record<string, unknown> }).reward;
  if (!r) return undefined;
  const cdp = Number(r.cdp ?? 0);
  if (!Number.isFinite(cdp) || cdp <= 0) return undefined;
  return { cdp: Math.floor(cdp) };
}

export function mailboxRowToItem(row: MailboxRow): MailItem {
  const payload = row.payload ?? {};
  return {
    id: row.id,
    kind: asKind(row.kind),
    title: row.title,
    body: row.body,
    sender: row.sender || '시스템',
    createdAt: new Date(row.created_at).getTime(),
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
    titleGrant: asTitleGrant(payload),
    scoutInvite: asScout(payload),
    reward: asReward(payload),
    claimedAt: row.claimed_at ? new Date(row.claimed_at).getTime() : null,
  };
}
