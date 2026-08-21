'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
  전역 푸터.

  루트 레이아웃에 한 번만 두고, 푸터가 어울리지 않는 화면에서는 스스로 빠진다.
  페이지마다 붙이면 새 페이지를 만들 때마다 빼먹기 쉬워 한 곳에서 관리한다.

  배경은 항상 잉크색이다. 본문이 밝은 화면(로비·랭킹)에서도, 어두운 화면
  (소개)에서도 '여기서 페이지가 끝난다'는 경계를 만들어 준다.

  로고는 두지 않는다. 상단바가 이미 워드마크를 보여주고 저작권 줄도 같은
  이름을 적으므로, 푸터에까지 넣으면 한 화면에서 브랜드를 세 번 말하게 된다.
  상단바·하단탭바에 있는 링크를 되풀이하지 않는 것도 같은 이유다.
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
      {/*
        모바일에서는 하단 탭바가 화면 아래에 고정되어 푸터를 덮으므로,
        sm 미만에서만 탭바 높이만큼 여백을 더 준다.
      */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-7 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] text-center sm:pb-7 md:px-6">
        <nav
          aria-label="사이트 정보"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-cdm-ink-fg-muted transition-colors hover:text-cdm-ink-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <p className="mt-4 text-xs text-cdm-ink-fg-muted/70">
          © {new Date().getFullYear()} 커스텀 데스매치 (Custom Deathmatch)
        </p>
      </div>
    </footer>
  );
}
