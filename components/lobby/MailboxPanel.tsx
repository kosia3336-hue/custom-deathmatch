'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Icon } from '@/components/cdm/Icon';
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

/**
 * 남은 기한. 임박한 것만 눈에 띄게 한다.
 * 하루가 안 남으면 시간 단위로 세는데, '3일 남음' 과 '2시간 남음' 은
 * 급한 정도가 다르기 때문이다.
 */
function formatRemaining(expiresAt: number): { text: string; urgent: boolean } | null {
  const left = expiresAt - Date.now();
  if (left <= 0) return null;
  // 일 단위는 내림이 아니라 반올림이다. 7일짜리를 보낸 직후 '6일 남음' 으로
  // 보이면 보낸 사람도 받는 사람도 잘못 읽는다.
  if (left >= 86_400_000) {
    return { text: `${Math.round(left / 86_400_000)}일 남음`, urgent: left < 2 * 86_400_000 };
  }
  const hours = Math.floor(left / 3_600_000);
  if (hours >= 1) return { text: `${hours}시간 남음`, urgent: true };
  return { text: `${Math.max(1, Math.floor(left / 60_000))}분 남음`, urgent: true };
}

/** 목록에서 바로 보이는 동봉물 요약. 지금 담기는 것은 CDP 뿐이다. */
function MailAttachments({ mail }: { mail: MailItem }) {
  const remaining = mail.expiresAt ? formatRemaining(mail.expiresAt) : null;
  const claimed = mail.claimedAt != null;
  if (!mail.reward && !remaining) return null;

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1">
      {mail.reward && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
            claimed
              ? 'bg-cdm-bg-elev-2 text-cdm-fg-subtle line-through'
              : 'bg-cdm-success-soft text-cdm-success',
          )}
        >
          {mail.reward.cdp.toLocaleString()} CDP
        </span>
      )}
      {mail.reward && claimed && (
        <span className="text-[11px] font-semibold text-cdm-fg-subtle">수령 완료</span>
      )}
      {remaining && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-[11px] font-semibold',
            remaining.urgent ? 'text-cdm-accent' : 'text-cdm-fg-subtle',
          )}
        >
          <Icon name="clock" size="sm" className="h-3.5 w-3.5" />
          {remaining.text}
        </span>
      )}
    </span>
  );
}

/**
 * 삭제 한 번. 서버가 거부하면(미수령 보상) 이유를 띄운다.
 * 스토어가 낙관적 삭제를 되돌리므로 여기서 목록을 손댈 것은 없다.
 */
async function deleteMail(
  id: string,
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<void> {
  const r = await remove(id);
  if (!r.ok) toast.error(r.error ?? '편지를 지우지 못했습니다.');
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
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
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6.5a8 8 0 0 1 0 11"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'reward') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 12h18M12 8v13" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 8c0-2 1.5-3.5 4-3.5S16 6 16 8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MailListRow({
  mail,
  onOpen,
  onDelete,
}: {
  mail: MailItem;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = KIND_META[mail.kind];
  const unread = !mail.readAt;
  // 칭호 편지는 body 가 '칭호 획득!' 뒤에 오는 설명이라 칭호 이름을 앞세운다.
  const preview = mail.titleGrant
    ? `「${mail.titleGrant.name}」 ${mail.titleGrant.description ?? ''}`.trim()
    : mail.body;
  return (
    <div
      className={cn(
        'relative flex items-stretch overflow-hidden transition-colors',
        'hover:bg-cdm-bg-elev-1',
        unread ? 'bg-cdm-primary-soft/60' : 'bg-cdm-bg',
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-0.5', meta.bar)} />
      <button
        type="button"
        onClick={() => onOpen(mail.id)}
        className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left"
      >
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
          <span
            className={cn(
              'block truncate text-sm',
              unread ? 'font-bold text-cdm-fg' : 'font-medium text-cdm-fg',
            )}
          >
            {mail.title}
          </span>
          {/* 열지 않고도 무슨 편지인지 알 수 있게 두 줄까지 보여 준다. */}
          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-cdm-fg-muted">
            {preview}
          </span>
          <MailAttachments mail={mail} />
          <span className="mt-1.5 flex items-center gap-1.5">
            {unread && (
              <span className="h-1.5 w-1.5 rounded-full bg-cdm-primary" aria-label="미읽음" />
            )}
            <span className={cn('text-[11px] font-semibold', meta.fg)}>{meta.label}</span>
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1 px-2 py-3">
        <span className="text-[11px] text-cdm-fg-subtle">{formatMailTime(mail.createdAt)}</span>
        {/*
          예전엔 '삭제' 라는 빨간 글자가 제목과 같은 크기로 붙어 있어
          목록에서 그 글자가 제일 먼저 읽혔다. 아이콘 버튼으로 낮춘다.
        */}
        <button
          type="button"
          onClick={() => onDelete(mail.id)}
          className="rounded-cdm-md p-1.5 text-cdm-fg-subtle transition-colors hover:bg-cdm-bg-elev-2 hover:text-cdm-accent"
          title="이 편지 삭제"
          aria-label="이 편지 삭제"
        >
          <Icon name="trash" size="sm" />
        </button>
      </div>
    </div>
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
  const setOpen = useMailboxStore((s) => s.setOpen);
  const remaining = mail.expiresAt ? formatRemaining(mail.expiresAt) : null;
  // 받지 않은 보상이 달렸으면 서버가 삭제를 거부한다. 여기서도 미리 막아
  // 눌러 봐야 실패하는 버튼을 두지 않는다.
  const rewardPending = Boolean(mail.reward) && mail.claimedAt == null;

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
              strokeWidth="1.8"
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
            {remaining && (
              <span
                className={cn(
                  'ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold',
                  remaining.urgent ? 'text-cdm-accent' : 'text-cdm-fg-subtle',
                )}
              >
                <Icon name="clock" size="sm" className="h-3.5 w-3.5" />
                {remaining.text}
              </span>
            )}
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
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-block text-sm font-semibold text-cdm-primary hover:underline"
                >
                  공지 보기
                </Link>
              )}
              {mail.id.startsWith('inquiry:') && (
                <Link
                  href="/me?tab=support"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-block text-sm font-semibold text-cdm-primary hover:underline"
                >
                  문의 내역 보기
                </Link>
              )}
              {mail.id.startsWith('guild-join:') && (
                <Link
                  href="/guild"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-block text-sm font-semibold text-cdm-primary hover:underline"
                >
                  가입 신청 보기
                </Link>
              )}
              {mail.scoutInvite ? (
                <div className="mt-4">
                  <Button size="sm" onClick={() => onOpenScout(mail.scoutInvite!)}>
                    길드 확인
                  </Button>
                </div>
              ) : null}
              {mail.reward ? <RewardClaim mail={mail} /> : null}
            </>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={rewardPending}
            onClick={() => {
              setFocusId(null);
              void deleteMail(mail.id, remove);
              onBack();
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-cdm-md border px-3 py-1.5 text-xs font-semibold transition-colors',
              rewardPending
                ? 'border-cdm-border text-cdm-fg-subtle opacity-60'
                : 'border-cdm-border text-cdm-fg-muted hover:border-cdm-accent hover:text-cdm-accent',
            )}
          >
            <Icon name="trash" size="sm" />
            삭제
          </button>
          {rewardPending && (
            <span className="text-[11px] text-cdm-fg-subtle">보상을 받은 뒤 지울 수 있습니다.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 보상 수령 버튼.
 * 지급은 서버 RPC 안에서 끝나고 멱등하다. 여기서는 결과를 보여 주기만 한다.
 */
function RewardClaim({ mail }: { mail: MailItem }) {
  const claim = useMailboxStore((s) => s.claim);
  const claiming = useMailboxStore((s) => s.claiming);
  const [error, setError] = useState<string | null>(null);
  const reward = mail.reward;
  if (!reward) return null;

  const done = mail.claimedAt != null;
  const busy = claiming === mail.id;

  return (
    <div className="border-cdm-border mt-4 rounded-cdm-md border p-3">
      <p className="text-cdm-fg-muted text-xs font-semibold">받을 보상</p>
      <p className="text-cdm-primary mt-1 text-lg font-black tabular-nums">
        {reward.cdp.toLocaleString()} CDP
      </p>
      {done ? (
        <p className="text-cdm-fg-muted mt-2 text-sm font-semibold">수령 완료</p>
      ) : (
        <Button
          size="sm"
          className="mt-2"
          disabled={busy}
          onClick={async () => {
            setError(null);
            const r = await claim(mail.id);
            if (!r.ok) setError(r.error ?? '이미 받았거나 받을 수 없는 보상입니다.');
          }}
        >
          {busy ? '받는 중...' : '받기'}
        </Button>
      )}
      {error && <p className="text-cdm-accent mt-2 text-xs">{error}</p>}
    </div>
  );
}

/** 로비 모달 우편함 탭. 부모는 flex column + overflow hidden. */
export function MailboxPanel() {
  const items = useMailboxStore((s) => s.items);
  const refresh = useMailboxStore((s) => s.refresh);
  const markRead = useMailboxStore((s) => s.markRead);
  const markAllRead = useMailboxStore((s) => s.markAllRead);
  const remove = useMailboxStore((s) => s.remove);
  const focusId = useMailboxStore((s) => s.focusId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scoutInfo, setScoutInfo] = useState<{
    guild: GuildSummary;
    canApply: boolean;
  } | null>(null);
  const [scoutBusy, setScoutBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      {items.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-cdm-border bg-cdm-bg px-4 py-2.5">
          <p className="text-xs text-cdm-fg-muted">
            {unread > 0 ? `미읽음 ${unread}통` : `전체 ${items.length}통`}
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
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cdm-primary-soft text-cdm-primary">
            <EnvelopeIcon className="h-8 w-8" />
          </span>
          <p className="text-sm font-semibold text-cdm-fg">우편함이 비어 있습니다</p>
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
                onDelete={(id) => void deleteMail(id, remove)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
