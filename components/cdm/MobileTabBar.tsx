'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

interface Props {
  /** 로그인 여부 — true 면 상점 탭 노출 */
  isMember: boolean;
}

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * '메뉴' 시트에 들어갈 부메뉴 — 상단 바가 없는 모바일에서 접근 경로 확보.
 * 하단 기본 탭은 랭킹/로비/메뉴 3개로 줄이고, 게임 룰·칭호·상점은 이 시트로 모은다.
 */
const MENU_ITEMS: { href: string; label: string; icon: React.ReactNode; memberOnly?: boolean }[] = [
  { href: '/titles', label: '칭호', icon: <Icon name="title" size="lg" /> },
  { href: '/shop', label: '상점', icon: <Icon name="shop" size="lg" />, memberOnly: true },
  { href: '/notice', label: '공지사항', icon: <Icon name="notice" size="lg" /> },
  // '소개'(/about)는 여기 두지 않는다 — 로비 대문 캐러셀과 푸터에서 들어간다.
  { href: '/guild', label: '길드', icon: <Icon name="guild" size="lg" />, memberOnly: true },
  { href: '/attendance', label: '출석판', icon: <Icon name="attendance" size="lg" />, memberOnly: true },
];

/** 모바일 하단 탭 바 — 앱처럼 주요 메뉴를 하단에 고정. 게임/대기실에서는 숨김. */
export function MobileTabBar({ isMember }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 라우트 이동 시 시트 닫기
  useEffect(() => {
    setMenuOpen((v) => (v ? false : v));
  }, [pathname]);

  // 하단 탭은 재설계안대로 4개만 둔다. 시트는 홈 헤더의 메뉴 버튼이 연다.
  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener('cdm:open-menu', open);
    return () => window.removeEventListener('cdm:open-menu', open);
  }, []);

  // 게임 화면(방/게임)에서는 표시하지 않음
  if (pathname?.startsWith('/room') || pathname?.startsWith('/game')) return null;

  // 소개 페이지는 히어로가 화면을 쓰므로 하단 탭은 숨긴다. 로비 등 나머지 공개 페이지에는 둔다.
  if (pathname === '/about') return null;

  const menuItems = MENU_ITEMS.filter((m) => isMember || !m.memberOnly);

  // 앱 재설계안의 하단 탭 4개 — 홈 · 랭크 · 게임 · 내정보.
  // '메뉴' 시트는 그대로 둔다: 길드·출석판·공지는 아직 다른 진입점이 없다.
  const tabs: Tab[] = [
    { href: '/lobby', label: '홈', icon: <Icon name="home" size="lg" /> },
    { href: '/ranking', label: '랭크', icon: <Icon name="rank" size="lg" /> },
    { href: '/rules', label: '게임', icon: <Icon name="game" size="lg" /> },
    { href: '/me', label: '내정보', icon: <Icon name="me" size="lg" /> },
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

          {/*
            메뉴 시트 진입점. 홈 헤더에 있던 햄버거를 여기로 옮겼다 —
            로비 밖(랭킹·룰 등)에서도 같은 자리에서 열 수 있다.
          */}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              className={cn(
                'flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                menuOpen || menuActive ? 'text-white' : 'text-cdm-ink-fg-muted hover:text-white',
              )}
            >
              <Icon name="menu" size="lg" />
              <span className="truncate">메뉴</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
