'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/cdm/Logo';
import { BgmButton } from '@/components/cdm/BgmButton';
import { CdpBalanceChip } from '@/components/cdm/CdpBalanceChip';
import { OnlineUsersModalButton } from '@/components/lobby/OnlineUsersPanel';
import { MailboxModalButton } from '@/components/lobby/MailboxDialog';
import { RankQueueDesktopChip } from '@/components/rank/RankQueueFloatingIndicator';
import { useCurrentMember } from '@/hooks/useCurrentMember';

const ABOUT_NAV: { id: string; label: string; icon: string }[] = [
  { id: 'platform', label: '플랫폼', icon: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'rank', label: '랭크', icon: 'M8 21V10M12 21V3M16 21v-7M4 21h16' },
  { id: 'titles', label: '칭호', icon: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1' },
  { id: 'shop', label: '상점', icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { id: 'guild', label: '길드', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { id: 'rules', label: '게임 룰', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5' },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 모바일 주소창이 접히며 visual viewport 가 밀릴 때,
 * 레이아웃 기준 fixed/sticky 크롬이 화면 밖으로 나가는 만큼 되돌린다.
 * 로비는 문서 스크롤이 바로 잡혀 이 밀림이 거의 없고, 소개는 풀화면 섹션이라 잘 탄다.
 */
function useVisualViewportInsets() {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      if (window.matchMedia('(min-width: 640px)').matches) {
        setInsets({ top: 0, bottom: 0 });
        return;
      }
      const top = Math.max(0, vv.offsetTop);
      const bottom = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      setInsets({ top, bottom });
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return insets;
}

function TabIcon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** 소개 페이지 전용 GNB. 로비와 같은 방식: 상단 sticky, 모바일 메뉴는 하단 fixed. */
export default function AboutGNB() {
  const { member, loading } = useCurrentMember();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const insets = useVisualViewportInsets();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      requestAnimationFrame(() => scrollToSection(hash));
    }
  }, []);

  const go = (id: string) => {
    scrollToSection(id);
    setActiveId(id);
  };

  return (
    <>
    <header
      className="fixed inset-x-0 top-0 z-(--cdm-z-sticky) border-b border-cdm-ink-border bg-cdm-ink sm:sticky sm:bg-cdm-ink/95 sm:backdrop-blur"
      style={insets.top ? { transform: `translateY(${insets.top}px)` } : undefined}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link
          href="/about"
          aria-label="홈"
          className="flex min-w-0 shrink cursor-pointer items-center"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setActiveId(null);
          }}
        >
          <Logo size="md" className="pointer-events-none h-5 w-auto sm:h-8" />
        </Link>

        <nav className="hidden gap-1 sm:flex">
          {ABOUT_NAV.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(it.id);
              }}
              className={cn(
                'cursor-pointer rounded-cdm-md px-3 py-2 text-sm font-medium transition-colors',
                activeId === it.id
                  ? 'bg-white/10 text-white'
                  : 'text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white',
              )}
            >
              {it.label}
            </a>
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

          {loading ? (
            <div className="h-8 w-22 animate-pulse rounded-cdm-md bg-white/10" />
          ) : member ? (
            <div ref={ref} className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-cdm-md px-2 text-xs font-semibold text-cdm-ink-fg hover:bg-white/10 sm:h-9 sm:px-3 sm:text-sm"
              >
                <span className="max-w-[8em] truncate">{member.nickname}</span>
                <span aria-hidden className="text-xs text-cdm-ink-fg-muted">
                  ▾
                </span>
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 min-w-[180px] overflow-hidden rounded-cdm-md border border-cdm-border bg-cdm-bg shadow-(--cdm-shadow-md)"
                >
                  <Link
                    href="/lobby"
                    className="block px-4 py-2.5 text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    로비
                  </Link>
                  <Link
                    href="/me"
                    className="block px-4 py-2.5 text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    마이페이지
                  </Link>
                  <a
                    href="/auth/signout"
                    className="block px-4 py-2.5 text-sm text-cdm-accent hover:bg-cdm-bg-elev-1"
                    role="menuitem"
                  >
                    로그아웃
                  </a>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex h-8 cursor-pointer items-center whitespace-nowrap rounded-cdm-md bg-white px-2.5 text-xs font-semibold text-cdm-ink transition-colors hover:bg-cdm-ink-fg sm:h-9 sm:px-4 sm:text-sm"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
    <div className="h-14 shrink-0 sm:hidden" aria-hidden />

    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-(--cdm-z-sticky) border-t border-cdm-ink-border bg-cdm-ink pb-[env(safe-area-inset-bottom)] sm:hidden"
      style={insets.bottom ? { transform: `translateY(-${insets.bottom}px)` } : undefined}
    >
      <ul className="flex">
        {ABOUT_NAV.map((it) => (
          <li key={it.id} className="min-w-0 flex-1">
            <a
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(it.id);
              }}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                activeId === it.id ? 'text-white' : 'text-cdm-ink-fg-muted hover:text-white',
              )}
              aria-current={activeId === it.id ? 'location' : undefined}
            >
              <TabIcon d={it.icon} />
              <span className="truncate">{it.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
    </>
  );
}
