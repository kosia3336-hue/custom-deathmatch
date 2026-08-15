'use client';

import Link from 'next/link';
import { LOBBY_PEEK_COOKIE, LOBBY_PEEK_MAX_AGE } from '@/lib/lobbyPeek';

/**
 * '로비 둘러보기' — 로그인 없이 메인(로비)으로 들어가는 링크.
 *
 * 표식 쿠키를 심고 이동한다. 쿠키가 없으면 미들웨어가 '/' 를 다시 소개 페이지로
 * 돌려보내기 때문이다. document.cookie 는 동기라 이동 전에 반드시 심어진다.
 *
 * 이동은 일부러 전체 로드(location.assign)로 한다. 소프트 내비게이션은 쿠키가
 * 없던 시점에 받아 둔 '소개 페이지로 돌아가라'는 응답을 그대로 재사용해서,
 * 눌러도 /guide 로 되돌아오는 것을 실제로 확인했다. prefetch 를 꺼도 마찬가지다.
 * href 는 그대로 두어 새 탭 열기·링크 복사는 정상 동작한다.
 */
export default function LobbyPeekLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="/"
      prefetch={false}
      className={className}
      onClick={(e) => {
        // 새 탭·새 창 등 브라우저 기본 동작은 건드리지 않는다
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        document.cookie = `${LOBBY_PEEK_COOKIE}=1; path=/; max-age=${LOBBY_PEEK_MAX_AGE}; samesite=lax`;
        window.location.assign('/');
      }}
    >
      {children}
    </Link>
  );
}
