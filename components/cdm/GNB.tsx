'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { BgmButton } from './BgmButton';
import { CdpBalanceChip } from './CdpBalanceChip';
import { OnlineUsersModalButton } from '@/components/lobby/OnlineUsersPanel';
import InquirySubmitModal from '@/components/InquirySubmitModal';
import { RankQueueDesktopChip } from '@/components/rank/RankQueueFloatingIndicator';
import InventoryInit from '@/components/providers/InventoryInit';
import type { CurrentMember } from '@/lib/auth/server';

interface GNBProps {
  member: CurrentMember | null;
  /** true이면 우측(로그인/닉네임) 영역을 스켈레톤으로 표시 */
  loadingRight?: boolean;
  /** 미읽음 공지 수 (로그인 사용자만) */
  unreadNoticeCount?: number;
}

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/', label: '로비' },
  { href: '/ranking', label: '랭킹' },
  { href: '/titles', label: '칭호' },
  { href: '/notice', label: '공지사항' },
];

/** 로그인한 사용자에게만 노출되는 메뉴 (비로그인은 미들웨어로 차단) */
const MEMBER_NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/shop', label: '상점' },
];

export function GNB({ member, loadingRight = false, unreadNoticeCount = 0 }: GNBProps) {
  const [open, setOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
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
    <header className="sticky top-0 z-(--cdm-z-sticky) border-b border-cdm-border bg-cdm-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="홈" className="flex items-center gap-3">
          <Logo size="sm" />
        </Link>

        <nav className="hidden gap-1 sm:flex">
          {NAV_ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'rounded-cdm-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === it.href || (it.href !== '/' && pathname?.startsWith(it.href))
                  ? 'text-cdm-fg bg-cdm-bg-elev-1'
                  : 'text-cdm-fg-muted hover:text-cdm-fg hover:bg-cdm-bg-elev-1',
              )}
            >
              {it.label}
              {it.href === '/notice' && unreadNoticeCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cdm-primary px-1 text-[10px] font-bold leading-none text-white">
                  {unreadNoticeCount > 9 ? '9+' : unreadNoticeCount}
                </span>
              )}
            </Link>
          ))}
          {member &&
            MEMBER_NAV_ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'rounded-cdm-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === it.href || pathname?.startsWith(it.href)
                    ? 'text-cdm-fg bg-cdm-bg-elev-1'
                    : 'text-cdm-fg-muted hover:text-cdm-fg hover:bg-cdm-bg-elev-1',
                )}
              >
                {it.label}
              </Link>
            ))}
          {member && (
            <button
              type="button"
              onClick={() => setInquiryOpen(true)}
              className="rounded-cdm-md px-3 py-2 text-sm font-medium text-cdm-fg-muted transition-colors hover:text-cdm-fg hover:bg-cdm-bg-elev-1"
            >
              문의
            </button>
          )}
        </nav>

        <div className="flex items-center gap-1">
          {member && (
            <span className="hidden sm:inline-flex">
              <CdpBalanceChip />
            </span>
          )}
          <span className="hidden md:flex items-center">
            <RankQueueDesktopChip />
          </span>
          <BgmButton />
          <OnlineUsersModalButton />

        {loadingRight ? (
          <div className="h-8 w-22 animate-pulse rounded-cdm-md bg-cdm-bg-elev-2" />
        ) : member ? (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-1.5 rounded-cdm-md px-3 py-2 text-sm font-semibold text-cdm-fg hover:bg-cdm-bg-elev-1"
            >
              <span className="relative max-w-[8em] truncate">
                {member.nickname}
                {unreadNoticeCount > 0 && (
                  <span
                    aria-label={`미읽음 공지 ${unreadNoticeCount}건`}
                    className="absolute -top-0.5 -right-2.5 h-2 w-2 rounded-full bg-cdm-primary"
                  />
                )}
              </span>
              <span aria-hidden className="text-xs text-cdm-fg-muted">
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
                <MenuLink href="/me?tab=settings" label="환경 설정" />
                {member.role === 'admin' && (
                  <>
                    <hr className="border-cdm-border" />
                    <MenuLink href="/admin" label="관리자" />
                  </>
                )}
                <div className="sm:hidden">
                  <hr className="border-cdm-border" />
                  <CdpBalanceChip variant="mobile" />
                  {NAV_ITEMS.map((it) =>
                    it.href === '/notice' && unreadNoticeCount > 0 ? (
                      <MenuLink
                        key={it.href}
                        href={it.href}
                        label={it.label}
                        badge={unreadNoticeCount}
                      />
                    ) : (
                      <MenuLink key={it.href} href={it.href} label={it.label} />
                    ),
                  )}
                  {MEMBER_NAV_ITEMS.map((it) => (
                    <MenuLink key={it.href} href={it.href} label={it.label} />
                  ))}
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setInquiryOpen(true); }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
                  >
                    문의
                  </button>
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
            className="rounded-cdm-md bg-cdm-primary px-4 py-2 text-sm font-semibold text-cdm-fg-inverse hover:bg-cdm-primary-strong transition-colors"
          >
            로그인
          </Link>
        )}
        </div>
      </div>
    </header>

    {member && (
      <InquirySubmitModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        onSuccess={() => setInquiryOpen(false)}
      />
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
      {badge && badge > 0 ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cdm-primary px-1 text-[10px] font-bold leading-none text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  );
}
