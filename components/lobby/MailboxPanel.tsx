'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { GuildInfoModal } from '@/components/guild-v4/GuildInfoModal';
import { cn } from '@/lib/utils';
import type { GuildSummary } from '@/lib/guild/types';
import type { GuildV4Snapshot } from '@/lib/guild-v4/types';
import type { TitleColor } from '@/lib/supabase/database.types';
import {
  mailboxUnreadCount,
  useMailboxStore,
  type GuildScoutMail,
  type MailItem,
  type MailKind,
} from '@/stores/mailbox';

const KIND_META: Record<
  MailKind,
  { label: string; bar: string; soft: string; fg: string }
> = {
  title: {
    label: '칭호',
    bar: 'bg-cdm-primary',
    soft: 'bg-cdm-primary-soft',
    fg: 'text-cdm-primary',
  },
  guild: {
    label: '길드',
    bar: 'bg-cdm-info',
    soft: 'bg-cdm-info-soft',
    fg: 'text-cdm-info',
  },
  notice: {
    label: '공지',
    bar: 'bg-cdm-highlight',
    soft: 'bg-cdm-highlight-soft',
    fg: 'text-cdm-highlight-strong',
  },
  reward: {
    label: '보상',
    bar: 'bg-cdm-success',
    soft: 'bg-cdm-success-soft',
    fg: 'text-cdm-success',
  },
  system: {
    label: '시스템',
    bar: 'bg-cdm-fg-subtle',
    soft: 'bg-cdm-bg-elev-2',
    fg: 'text-cdm-fg-muted',
  },
};

function formatMailTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 45_000) return '방금';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  const d = new Date(ts);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}. ${d.getDate()}.`;
  }
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 7.5 12 13l8-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KindGlyph({ kind }: { kind: MailKind }) {
  const common = 'h-[18px] w-[18px]';
  if (kind === 'title') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3 14.5 8.5 20.5 9.2 16 13.4 17.2 19.4 12 16.6 6.8 19.4 8 13.4 3.5 9.2 9.5 8.5 12 3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'guild') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3 20 7v5c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V7l8-4Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'notice') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 10v6h2.5L12 21V3L7.5 8H5a2 2 0 0 0-2 2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6.5a8 8 0 0 1 0 11"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'reward') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 12h18M12 8v13" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M8 8c0-2 1.5-3.5 4-3.5S16 6 16 8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MailListRow({ mail, onOpen }: { mail: MailItem; onOpen: (id: string) => void }) {
  const meta = KIND_META[mail.kind];
  const unread = !mail.readAt;
  return (
    <button
      type="button"
      onClick={() => onOpen(mail.id)}
      className={cn(
        'relative flex w-full gap-3 overflow-hidden px-3 py-3 text-left transition-colors',
        'hover:bg-cdm-bg-elev-1',
        unread ? 'bg-cdm-primary-soft/60' : 'bg-cdm-bg',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-0.5', meta.bar)} />
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-cdm-md',
          meta.soft,
          meta.fg,
        )}
      >
        <KindGlyph kind={mail.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              unread ? 'font-bold text-cdm-fg' : 'font-medium text-cdm-fg',
            )}
          >
            {mail.title}
          </span>
          <span className="shrink-0 text-[11px] text-cdm-fg-subtle">{formatMailTime(mail.createdAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-cdm-fg-muted">{mail.body}</span>
        <span className="mt-1.5 flex items-center gap-1.5">
          {unread && (
            <span className="h-1.5 w-1.5 rounded-full bg-cdm-primary" aria-label="미읽음" />
          )}
          <span className={cn('text-[11px] font-semibold', meta.fg)}>{meta.label}</span>
        </span>
      </span>
    </button>
  );
}

function MailDetail({
  mail,
  onBack,
  onOpenScout,
}: {
  mail: MailItem;
  onBack: () => void;
  onOpenScout: (invite: GuildScoutMail) => void;
}) {
  const meta = KIND_META[mail.kind];
  const remove = useMailboxStore((s) => s.remove);
  const setFocusId = useMailboxStore((s) => s.setFocusId);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-cdm-bg-elev-1">
      <div className="flex items-center gap-1 border-b border-cdm-border bg-cdm-bg px-2 py-2">
        <button
          type="button"
          onClick={() => {
            setFocusId(null);
            onBack();
          }}
          className="flex items-center gap-1 rounded-cdm-md px-2 py-1.5 text-sm font-medium text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-2 hover:text-cdm-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 6 9 12l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          목록
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg p-4 shadow-(--cdm-shadow-sm)">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                meta.soft,
                meta.fg,
              )}
            >
              <KindGlyph kind={mail.kind} />
              {meta.label}
            </span>
            <span className="text-[11px] text-cdm-fg-subtle">{formatMailTime(mail.createdAt)}</span>
          </div>
          {mail.titleGrant ? (
            <div className="mt-4 flex flex-col items-center gap-4 py-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-cdm-primary">
                칭호 획득!
              </p>
              <TitleBadge
                name={mail.titleGrant.name}
                color={mail.titleGrant.color as TitleColor}
                effect={mail.titleGrant.effect as TitleEffect | null}
                size="lg"
              />
              {mail.titleGrant.description && (
                <p className="text-sm text-cdm-fg-muted">{mail.titleGrant.description}</p>
              )}
            </div>
          ) : (
            <>
              <h3 className="mt-3 text-base font-bold leading-snug text-cdm-fg">{mail.title}</h3>
              <p className="mt-1 text-xs text-cdm-fg-muted">보낸이 · {mail.sender}</p>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-cdm-fg">
                {mail.body}
              </div>
              {mail.kind === 'notice' && mail.id.startsWith('notice:') && (
                <Link
                  href={`/notice/${mail.id.slice('notice:'.length)}`}
                  className="mt-3 inline-block text-sm font-semibold text-cdm-primary hover:underline"
                >
                  공지 보기
                </Link>
              )}
              {mail.scoutInvite ? (
                <div className="mt-4">
                  <Button size="sm" onClick={() => onOpenScout(mail.scoutInvite!)}>
                    길드 확인
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setFocusId(null);
            remove(mail.id);
            onBack();
          }}
          className="mt-4 text-xs text-cdm-fg-subtle underline-offset-2 hover:text-cdm-accent hover:underline"
        >
          이 편지 삭제
        </button>
      </div>
    </div>
  );
}

/** 로비 모달 우편함 탭. 부모는 flex column + overflow hidden. */
export function MailboxPanel() {
  const items = useMailboxStore((s) => s.items);
  const hydrate = useMailboxStore((s) => s.hydrate);
  const markRead = useMailboxStore((s) => s.markRead);
  const markAllRead = useMailboxStore((s) => s.markAllRead);
  const focusId = useMailboxStore((s) => s.focusId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scoutInfo, setScoutInfo] = useState<{
    guild: GuildSummary;
    canApply: boolean;
  } | null>(null);
  const [scoutBusy, setScoutBusy] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!focusId) return;
    const target = useMailboxStore.getState().items.find((m) => m.id === focusId);
    if (!target) return;
    if (!target.readAt) markRead(focusId);
    setOpenId(focusId);
  }, [focusId, markRead]);

  const openMail = items.find((m) => m.id === openId) ?? null;
  const unread = mailboxUnreadCount(items);

  useEffect(() => {
    if (openId && !items.some((m) => m.id === openId)) setOpenId(null);
  }, [items, openId]);

  async function openScoutGuild(invite: GuildScoutMail) {
    setScoutBusy(true);
    try {
      const res = await fetch('/api/guild2');
      const snap = (await res.json()) as GuildV4Snapshot & { error?: string };
      if (!res.ok) {
        toast.error(snap.error ?? '길드 정보를 불러오지 못했습니다.');
        return;
      }
      const guild = snap.guilds.find((g) => g.id === invite.guildId) ?? null;
      if (!guild) {
        toast.error('길드를 찾을 수 없습니다.');
        return;
      }
      setScoutInfo({
        guild,
        canApply: !snap.my.guild,
      });
    } catch {
      toast.error('길드 정보를 불러오지 못했습니다.');
    } finally {
      setScoutBusy(false);
    }
  }

  if (openMail) {
    return (
      <>
        <MailDetail mail={openMail} onBack={() => setOpenId(null)} onOpenScout={(invite) => void openScoutGuild(invite)} />
        {scoutInfo ? (
          <GuildInfoModal
            guild={scoutInfo.guild}
            busy={scoutBusy}
            canApply={scoutInfo.canApply}
            onClose={() => setScoutInfo(null)}
            onJoin={async () => {
              setScoutBusy(true);
              try {
                const res = await fetch('/api/guild2', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'join', guildId: scoutInfo.guild.id }),
                });
                const json = (await res.json()) as { error?: string };
                if (!res.ok) {
                  toast.error(json.error ?? '신청에 실패했습니다.');
                  return;
                }
                toast.success('가입 신청을 보냈어요.');
                setScoutInfo(null);
              } catch {
                toast.error('신청에 실패했습니다.');
              } finally {
                setScoutBusy(false);
              }
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-cdm-bg-elev-1">
      <div className="flex items-center justify-between gap-2 border-b border-cdm-border bg-cdm-bg px-4 py-2.5">
        <p className="text-xs text-cdm-fg-muted">
          {items.length === 0
            ? '받은 편지 없음'
            : unread > 0
              ? `미읽음 ${unread}통`
              : `전체 ${items.length}통`}
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-semibold text-cdm-primary hover:underline"
          >
            모두 읽음
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cdm-primary-soft text-cdm-primary">
            <EnvelopeIcon className="h-8 w-8" />
          </span>
          <p className="text-sm font-semibold text-cdm-fg">우편함이 비어 있습니다</p>
          <p className="text-xs leading-relaxed text-cdm-fg-muted">
            칭호를 얻거나 길드 보상을 받으면
            <br />
            여기에 남습니다.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-cdm-border overflow-y-auto bg-cdm-bg">
          {items.map((mail) => (
            <li key={mail.id}>
              <MailListRow
                mail={mail}
                onOpen={(id) => {
                  markRead(id);
                  setOpenId(id);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
