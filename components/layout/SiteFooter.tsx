'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/cdm/Logo';

/*
  전역 푸터.

  루트 레이아웃에 한 번만 두고, 푸터가 어울리지 않는 화면에서는 스스로 빠진다.
  페이지마다 붙이면 새 페이지를 만들 때마다 빼먹기 쉬워 한 곳에서 관리한다.

  배경은 항상 잉크색이다. 본문이 밝은 화면(로비·랭킹)에서도, 어두운 화면
  (소개)에서도 '여기서 페이지가 끝난다'는 경계를 만들어 준다.
*/

/** 푸터를 감출 경로 — 몰입이 필요하거나(인게임) 관리/인증 흐름인 화면 */
const HIDDEN_PREFIXES = [
  '/room',        // 인게임·대기실
  '/admin',
  '/auth',
  '/signup',
  '/login',
  '/banned',
  '/suspended',
  '/withdrawn',
  '/disconnected',
];

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/about', label: '소개' },
  { href: '/rules', label: '게임 룰' },
  { href: '/notice', label: '공지사항' },
  { href: '/support/inquiry', label: '문의하기' },
  { href: '/legal/terms', label: '이용약관' },
  { href: '/legal/privacy', label: '개인정보 처리방침' },
];

export default function SiteFooter() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-cdm-ink-border bg-cdm-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo size="sm" className="h-5 w-auto" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-cdm-ink-fg-muted">
              설치 없이 브라우저에서 즐기는 1:1 심리·전략 두뇌 게임.
            </p>
          </div>

          <nav aria-label="사이트 정보">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-3 md:gap-x-10">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-cdm-ink-fg-muted transition-colors hover:text-cdm-ink-fg"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-8 border-t border-cdm-ink-border pt-5 text-xs text-cdm-ink-fg-muted">
          © {new Date().getFullYear()} 커스텀 데스매치 (Custom Deathmatch)
        </p>
      </div>
    </footer>
  );
}
