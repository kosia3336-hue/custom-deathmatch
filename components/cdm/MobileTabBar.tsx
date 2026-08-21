'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Props {
  /** 로그인 여부 — true 면 상점 탭 노출 */
  isMember: boolean;
}

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function Icon({ d }: { d: string }) {
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

/**
 * '메뉴' 시트에 들어갈 부메뉴 — 상단 바가 없는 모바일에서 접근 경로 확보.
 * 하단 기본 탭은 랭킹/로비/메뉴 3개로 줄이고, 게임 룰·칭호·상점은 이 시트로 모은다.
 */
const MENU_ITEMS: { href: string; label: string; icon: React.ReactNode; memberOnly?: boolean }[] = [
  { href: '/rules', label: '게임 룰', icon: <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /> },
  { href: '/titles', label: '칭호', icon: <Icon d="M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1" /> },
  { href: '/shop', label: '상점', icon: <Icon d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />, memberOnly: true },
  { href: '/notice', label: '공지사항', icon: <Icon d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14" /> },
  // '소개'(/about)는 여기 두지 않는다 — 로비 대문 캐러셀과 푸터에서 들어간다.
  { href: '/guild', label: '길드', icon: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />, memberOnly: true },
  { href: '/attendance', label: '출석판', icon: <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M9 16l2 2 4-4" />, memberOnly: true },
];

/** 모바일 하단 탭 바 — 앱처럼 주요 메뉴를 하단에 고정. 게임/대기실에서는 숨김. */
export function MobileTabBar({ isMember }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 라우트 이동 시 시트 닫기
  useEffect(() => {
    setMenuOpen((v) => (v ? false : v));
  }, [pathname]);

  // 게임 화면(방/게임)에서는 표시하지 않음
  if (pathname?.startsWith('/room') || pathname?.startsWith('/game')) return null;

  // 소개 페이지는 히어로가 화면을 쓰므로 하단 탭은 숨긴다. 로비 등 나머지 공개 페이지에는 둔다.
  if (pathname === '/about') return null;

  const menuItems = MENU_ITEMS.filter((m) => isMember || !m.memberOnly);

  // 기본 탭은 랭킹 / 로비 / 메뉴 3개 (로비를 가운데로 — 앱 홈 버튼 관례)
  const tabs: Tab[] = [
    { href: '/ranking', label: '랭킹', icon: <Icon d="M8 21V10M12 21V3M16 21v-7M4 21h16" /> },
    { href: '/lobby', label: '로비', icon: <Icon d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  ];

  const menuActive = menuItems.some((m) => pathname?.startsWith(m.href));

  return (
    <>
      {/* 더보기 시트 */}
      {menuOpen && (
        <div className="fixed inset-0 z-(--cdm-z-overlay) sm:hidden" role="dialog" aria-label="메뉴">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-cdm-xl border-t border-cdm-ink-border bg-cdm-ink pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/20" aria-hidden />
            <p className="px-5 pb-2 text-xs font-semibold text-cdm-ink-fg-muted">메뉴</p>
            <ul className="grid grid-cols-3 gap-1 px-3 pb-2">
              {menuItems.map((m) => {
                const active = pathname?.startsWith(m.href);
                return (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      prefetch={active ? false : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-cdm-md py-3 text-[11px] font-medium transition-colors',
                        active ? 'bg-white/10 text-white' : 'text-cdm-ink-fg-muted hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <nav
        aria-label="하단 메뉴"
        className="fixed inset-x-0 bottom-0 z-(--cdm-z-sticky) border-t border-cdm-ink-border bg-cdm-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="flex">
          {tabs.map((t) => {
            const active = pathname?.startsWith(t.href);
            return (
              <li key={t.href} className="min-w-0 flex-1">
                <Link
                  href={t.href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                    active ? 'text-white' : 'text-cdm-ink-fg-muted hover:text-white',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {t.icon}
                  <span className="truncate">{t.label}</span>
                </Link>
              </li>
            );
          })}
          {/* 더보기(메뉴) — 상단 바 없는 모바일에서 길드·출석판·상점·공지 접근 */}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className={cn(
                'flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                menuOpen || menuActive ? 'text-white' : 'text-cdm-ink-fg-muted hover:text-white',
              )}
            >
              <Icon d="M4 6h16M4 12h16M4 18h16" />
              <span className="truncate">메뉴</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
