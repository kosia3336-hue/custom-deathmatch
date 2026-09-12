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
 * 랭킹·길드는 하단 탭으로 올라갔으므로 여기서는 뺀다(같은 곳으로 가는 문이 둘이면
 * 어느 쪽이 정식인지 흐려진다). 칭호·상점·공지·출석·문의는 이 시트가 유일한 문이다.
 */
const MENU_ITEMS: { href: string; label: string; icon: React.ReactNode; memberOnly?: boolean }[] = [
  { href: '/me', label: '내정보', icon: <Icon name="me" size="lg" />, memberOnly: true },
  { href: '/titles', label: '칭호', icon: <Icon name="title" size="lg" /> },
  { href: '/shop', label: '상점', icon: <Icon name="shop" size="lg" />, memberOnly: true },
  { href: '/notice', label: '공지사항', icon: <Icon name="notice" size="lg" /> },
  // '소개'(/about)는 여기 두지 않는다 — 푸터에서 들어간다.
  { href: '/attendance', label: '출석판', icon: <Icon name="attendance" size="lg" />, memberOnly: true },
  /*
    문의하기. 지금까지는 푸터에만 있어 모바일에서 사실상 닿지 않았다.
    비로그인도 쓸 수 있는 창구라 memberOnly 를 붙이지 않는다.
  */
  { href: '/support/inquiry', label: '문의하기', icon: <Icon name="inquiry" size="lg" /> },
];

/*
  활성 탭 표시.

  색만 바꾸면 작은 화면에서 잘 안 보인다. 위쪽 2px 선과 굵은 라벨을 함께 준다.
  인수인계 문서(§5)는 아이콘 fill 도 제안했지만 넣지 않았다 — 우리 아이콘은
  대부분 열린 선이라 채워도 변화가 없고, '게임'(rect 조합)은 사각형이 통째로
  칠해져 안쪽 줄이 묻힌다. 5개 중 2개만 의도대로 되고 1개는 깨진다.
*/
const TAB_BASE =
  'relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] transition-colors';
const TAB_STATE = (active: boolean) =>
  active ? 'font-semibold text-white' : 'font-medium text-cdm-ink-fg-muted hover:text-white';

/** 활성 탭 위에 얹는 2px 선 */
function TabIndicator() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-0.5 rounded-b-full bg-cdm-primary"
    />
  );
}

/** 모바일 하단 탭 바 — 앱처럼 주요 메뉴를 하단에 고정. 게임/대기실에서는 숨김. */
export function MobileTabBar({ isMember }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 라우트 이동 시 시트 닫기
  useEffect(() => {
    setMenuOpen((v) => (v ? false : v));
  }, [pathname]);

  // 홈 헤더의 메뉴 버튼도 같은 시트를 연다.
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

  /*
    하단 탭 다섯 — 게임 · 랭킹 · 홈 · 길드 · 메뉴.

    홈을 가운데 두어 좌우가 대칭이 된다. 랭킹과 길드는 메뉴 시트 안에 있었는데,
    시트를 열어야 닿는 곳이라 자주 가는 곳치고 멀었다. 다섯 칸이면 한 칸이
    좁아지지만(375px 기준 75px) 라벨이 두 글자 이하라 줄지 않는다.

    메뉴는 시트를 여는 버튼이라 Link 가 아니고, 아래 렌더에서 직접 붙인다.
  */
  const tabs: Tab[] = [
    { href: '/rules', label: '게임', icon: <Icon name="game" size="lg" /> },
    { href: '/ranking', label: '랭킹', icon: <Icon name="rank" size="lg" /> },
    { href: '/lobby', label: '홈', icon: <Icon name="home" size="lg" /> },
    { href: '/guild', label: '길드', icon: <Icon name="guild" size="lg" /> },
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
            {/*
              약관·개인정보 처리방침. 웹은 푸터에도 있지만 앱(웹뷰)은 푸터를 두지
              않으므로 여기가 앱에서의 입구다.
            */}
            <p className="flex justify-center gap-4 px-5 pt-1 pb-1 text-[11px] text-cdm-ink-fg-muted">
              <Link href="/legal/terms" onClick={() => setMenuOpen(false)} className="hover:text-white">
                이용약관
              </Link>
              <Link href="/legal/privacy" onClick={() => setMenuOpen(false)} className="hover:text-white">
                개인정보 처리방침
              </Link>
            </p>
          </div>
        </div>
      )}

      <nav
        aria-label="하단 메뉴"
        className="fixed inset-x-0 bottom-0 z-(--cdm-z-sticky) border-t border-cdm-ink-border bg-cdm-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {/* 높이는 --cdm-tabbar-h 로 고정 — 위에 뜨는 로비 행동 바·대기 표시가 이 값으로 자리 잡는다 */}
        <ul className="flex h-(--cdm-tabbar-h)">
          {tabs.map((t) => {
            const active = pathname?.startsWith(t.href);
            return (
              <li key={t.href} className="min-w-0 flex-1">
                <Link
                  href={t.href}
                  className={cn(TAB_BASE, TAB_STATE(Boolean(active)))}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && <TabIndicator />}
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
              className={cn(TAB_BASE, TAB_STATE(menuOpen || menuActive))}
            >
              {(menuOpen || menuActive) && <TabIndicator />}
              <Icon name="menu" size="lg" />
              <span className="truncate">메뉴</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
