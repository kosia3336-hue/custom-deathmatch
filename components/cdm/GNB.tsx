'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { BgmButton } from './BgmButton';
import { CdpBalanceChip } from './CdpBalanceChip';
import { OnlineUsersModalButton } from '@/components/lobby/OnlineUsersPanel';
import { MailboxModalButton } from '@/components/lobby/MailboxDialog';
import InquirySubmitModal from '@/components/InquirySubmitModal';
import { DevSwitchModal } from '@/components/cdm/DevSwitchModal';
import { UnreadBadge } from '@/components/cdm/UnreadBadge';
import { useGuildChatUnread } from '@/components/guild-v4/GuildChatLive';
import { RankQueueDesktopChip } from '@/components/rank/RankQueueFloatingIndicator';
import InventoryInit from '@/components/providers/InventoryInit';
import MailboxInit from '@/components/providers/MailboxInit';
import { MobileTabBar } from './MobileTabBar';
import type { CurrentMember } from '@/lib/auth/server';

interface GNBProps {
  /**
   * 모바일에서 상단 헤더를 감춘다. 로비처럼 화면 자체 헤더가 그 자리를
   * 대신하는 페이지용 — 하단 탭바는 그대로 렌더한다.
   */
  hideHeaderOnMobile?: boolean;
  member: CurrentMember | null;
  /** true이면 우측(로그인/닉네임) 영역을 스켈레톤으로 표시 */
  loadingRight?: boolean;
  /** 미읽음 공지 수 (로그인 사용자만) */
}

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/lobby', label: '로비' },
  { href: '/ranking', label: '랭킹' },
  { href: '/rules', label: '게임 룰' },
  { href: '/titles', label: '칭호' },
  { href: '/notice', label: '공지사항' },
  // '소개'(/about)는 여기 두지 않는다 — 푸터에서 들어간다.
  // 상단 바는 매일 쓰는 메뉴만 남긴다.
];

/** 로그인한 사용자에게만 노출되는 메뉴 (비로그인은 미들웨어로 차단) */
const MEMBER_NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/shop', label: '상점' },
  { href: '/guild', label: '길드' },
  { href: '/attendance', label: '출석판' },
];

export function GNB({ member, loadingRight = false, hideHeaderOnMobile = false }: GNBProps) {
  const [open, setOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [devSwitchOpen, setDevSwitchOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const guildUnread = useGuildChatUnread();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    // pathname 변경 시 드롭다운 닫기. 이미 닫혀 있으면 동일 state 반환 → re-render 스킵.
    setOpen((v) => (v ? false : v));
  }, [pathname]);

  return (
    <>
    <InventoryInit hasMember={Boolean(member)} />
    <MailboxInit memberId={member?.id ?? null} ready={!loadingRight} />
    <header
      className={cn(
        'sticky top-0 z-(--cdm-z-sticky) border-b border-cdm-ink-border bg-cdm-ink/95 backdrop-blur',
        hideHeaderOnMobile && 'hidden sm:block',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link href="/lobby" aria-label="홈" className="flex min-w-0 shrink items-center">
          <Logo size="md" className="h-5 w-auto sm:h-8" />
        </Link>

        <nav className="hidden gap-1 sm:flex">
          {NAV_ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'rounded-cdm-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === it.href || (it.href !== '/' && pathname?.startsWith(it.href))
                  ? 'text-white bg-white/10'
                  : 'text-cdm-ink-fg-muted hover:text-white hover:bg-white/10',
              )}
            >
                {it.label}
              </Link>
            ))}
          {member &&
            MEMBER_NAV_ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                prefetch={pathname?.startsWith(it.href) ? false : undefined}
                className={cn(
                  'inline-flex items-center gap-1 rounded-cdm-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === it.href || pathname?.startsWith(it.href)
                    ? 'text-white bg-white/10'
                    : 'text-cdm-ink-fg-muted hover:text-white hover:bg-white/10',
                )}
              >
                {it.label}
                {it.href === '/guild' ? <UnreadBadge count={guildUnread} /> : null}
              </Link>
            ))}
        </nav>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {member && (
            <span className="hidden sm:inline-flex">
              <CdpBalanceChip />
            </span>
          )}
          <span className="hidden md:flex items-center">
            <RankQueueDesktopChip />
          </span>
          <BgmButton className="text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white" />
          <OnlineUsersModalButton />
          {member && <MailboxModalButton />}


        {loadingRight ? (
          <div className="h-8 w-22 animate-pulse rounded-cdm-md bg-white/10" />
        ) : member ? (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex h-8 items-center gap-1.5 rounded-cdm-md px-2 text-xs font-semibold text-cdm-ink-fg hover:bg-white/10 sm:h-9 sm:px-3 sm:text-sm"
            >
              <span className="relative max-w-[8em] truncate">
                {member.nickname}
              </span>
              <span aria-hidden className="text-xs text-cdm-ink-fg-muted">
                ▾
              </span>
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-1 min-w-[180px] overflow-hidden rounded-cdm-md border border-cdm-border bg-cdm-bg shadow-(--cdm-shadow-md)"
              >
                <MenuLink href="/me" label="마이페이지" />
                <MenuLink href="/me?tab=titles" label="보유 칭호" />
                <MenuLink href="/me?tab=support" label="보낸 신고/문의" />
                <button
                  type="button"
                  onClick={() => { setOpen(false); setInquiryOpen(true); }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
                  role="menuitem"
                >
                  문의
                </button>
                <MenuLink href="/me?tab=settings" label="환경 설정" />
                {(member.role === 'admin' || member.canDevSwitch) && (
                  <>
                    <hr className="border-cdm-border" />
                    {member.role === 'admin' && <MenuLink href="/admin" label="관리자" />}
                    {member.canDevSwitch && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setDevSwitchOpen(true);
                        }}
                        className="block w-full px-4 py-2.5 text-left text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
                        role="menuitem"
                      >
                        데브 전환
                      </button>
                    )}
                  </>
                )}
                <div className="sm:hidden">
                  <hr className="border-cdm-border" />
                  <CdpBalanceChip variant="mobile" />
                </div>
                <hr className="border-cdm-border" />
                <a
                  href="/auth/signout"
                  className="block px-4 py-2.5 text-sm text-cdm-accent hover:bg-cdm-bg-elev-1"
                >
                  로그아웃
                </a>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex h-8 items-center whitespace-nowrap rounded-cdm-md bg-white px-2.5 text-xs font-semibold text-cdm-ink transition-colors hover:bg-cdm-ink-fg sm:h-9 sm:px-4 sm:text-sm"
          >
            로그인
          </Link>
        )}
        </div>
      </div>
    </header>

    <MobileTabBar isMember={Boolean(member)} />

    {member && (
      <InquirySubmitModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        onSuccess={() => setInquiryOpen(false)}
      />
    )}
    {member?.canDevSwitch && (
      <DevSwitchModal open={devSwitchOpen} onClose={() => setDevSwitchOpen(false)} />
    )}
  </>
  );
}

function MenuLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-2.5 text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
      role="menuitem"
    >
      {label}
      <UnreadBadge count={badge ?? 0} />
    </Link>
  );
}
