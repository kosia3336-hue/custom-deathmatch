import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { hasSeenIntro, markIntroSeen } from '@/lib/intro-cookie';

/**
 * Next.js Middleware — 세션 갱신 + 인증 가드.
 *
 * 라우트 분류:
 *   - public       : 어디서든 접근 가능. /login, /auth/*, /signup/*, /banned, /api/*, /notice/*
 *   - signup-only  : 가입 미완료 회원만. /signup/agreement, /signup/profile
 *   - inquiry-only : 정지 회원도 접근 가능. /support/inquiry, /me/inquiries (정책상)
 *   - active-only  : 정상 회원만. 그 외 모든 페이지 (예: /shop, /me, /admin, /room, /game)
 *
 * 영구정지(banned) → /banned
 * 일시정지(suspended) → /suspended (단 /support/inquiry, /auth/signout 은 허용)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Supabase 미설정 시 통과 (개발 초기)
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  // ── 정적 / API / 시스템 라우트 ─────────────────────────────────
  // 로컬 전용 UI 프리뷰 (/app/dev — gitignore, 프로덕션 빌드에 포함되지 않음)
  if (process.env.NODE_ENV === 'development' && pathname.startsWith('/dev')) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    // OG/트위터 카드 이미지 — 크롤러는 쿠키가 없어 로그인 리다이렉트되면 미리보기가 깨진다
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image') ||
    pathname.startsWith('/icon')
  ) {
    return NextResponse.next();
  }

  const { updateSession } = await import('@/lib/supabase/middleware');
  const { response, user } = await updateSession(request);

  // ── 비로그인 ────────────────────────────────────────────────
  // 소개(/about), 로비(/lobby), 랭킹(/ranking), 공지(/notice), 룰(/rules),
  // 약관(/legal/*), 초창기 로비(/classic) 등은 로그인 없이도 볼 수 있다. 로비는 둘러보기까지만 열어 두고,
  // 방 입장·생성 같은 실제 행동에서 각 화면이 로그인을 요구한다.
  // 마이페이지 등 로그인이 필요한 화면은 /login 으로 보낸다(로그인 후 원래 위치로 복귀).
  if (!user) {
    // '/' 는 입구. 소개를 아직 안 본 첫 방문만 /about, 이후에는 /lobby.
    // 로비·랭킹 등 다른 공개 주소로 바로 온 경우는 가로채지 않는다.
    if (pathname === '/') {
      if (hasSeenIntro(request.cookies)) {
        const redirect = NextResponse.redirect(new URL('/lobby', request.url));
        response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
        return redirect;
      }
      /*
        첫 방문(그리고 쿠키가 없는 크롤러)에게는 소개를 '/' 자리에서 그대로
        보여준다. 리다이렉트로 넘기면 브랜드 검색이 가장 먼저 매칭될 대표 주소인
        '/' 가 색인 대상에서 빠진다. app/page.tsx 가 소개를 직접 렌더링한다.

        308 로 바꾸는 방법은 쓸 수 없다. 목적지가 쿠키에 따라 달라지는데
        브라우저는 영구 리다이렉트를 캐시하므로, 한 번 '/'→'/about' 을 받은
        재방문자가 로비로 가지 못하게 된다.

        rewrite 도 쓸 수 없다. nginx 가 TLS 를 끊고 HTTP 로 넘기는 구조라
        request.url 이 https://localhost:3001 로 잡히고, Next 가 이를 외부
        주소로 보아 자기 자신에게 HTTPS 로 붙다가 EPROTO 로 죽는다.

        소개 본문의 canonical·og:url 이 /about 이라 '/' 와 '/about' 은 검색엔진에서
        '/about' 한 페이지로 합쳐진다. 검색 결과는 언제나 소개가 열리는 /about 으로
        잡혀야 한다 — '/' 로 잡히면 로그인·재방문자는 로비로 넘어가 룰을 못 본다.
      */
      markIntroSeen(response);
      return response;
    }

    const isPublic =
      pathname === '/about' ||
      pathname === '/guide' ||
      pathname === '/lobby' ||
      pathname === '/login' ||
      pathname.startsWith('/auth/') ||
      pathname === '/banned' ||
      pathname === '/suspended' ||
      pathname.startsWith('/legal/') ||
      pathname.startsWith('/ranking') ||
      pathname.startsWith('/notice') ||
      pathname.startsWith('/titles') ||
      pathname.startsWith('/rules') ||
      pathname.startsWith('/support/inquiry') ||
      pathname === '/classic' ||
      pathname.startsWith('/classic/');

    if (isPublic) {
      if (pathname === '/about') markIntroSeen(response);
      return response;
    }

    const login = new URLSearchParams({ next: pathname });
    return NextResponse.redirect(new URL(`/login?${login}`, request.url));
  }

  // ── 로그인 됨. members/members_private 읽어서 상태 분기 ──────
  const ssr = await import('@supabase/ssr');
  const sb = ssr.createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (xs) =>
          xs.forEach((c) => response.cookies.set(c.name, c.value, c.options)),
      },
    },
  );

  // 두 조회는 서로 의존하지 않는다. 미들웨어는 모든 페이지 이동마다 도므로
  // 순차로 기다리면 왕복 지연이 그대로 첫 바이트까지 밀린다.
  const [memberRes, privRes] = await Promise.all([
    sb.from('members').select('id, withdrawn_at').eq('id', user.id).maybeSingle(),
    sb
      .from('members_private')
      .select('status, role')
      .eq('member_id', user.id)
      .maybeSingle(),
  ]);
  const memberRow = memberRes.data as unknown as { id: string; withdrawn_at: string | null } | null;

  const isWithdrawn = !!memberRow?.withdrawn_at;
  const isSignupPending = !memberRow && !isWithdrawn;

  let status: 'active' | 'suspended' | 'banned' | undefined;
  let role: 'user' | 'admin' | undefined;
  if (memberRow && !isWithdrawn) {
    const privRow = privRes.data as unknown as { status?: string; role?: string } | null;
    status = privRow?.status as 'active' | 'suspended' | 'banned' | undefined;
    role = privRow?.role as 'user' | 'admin' | undefined;
  }

  // 가입 미완료 → /signup/profile 만 허용
  if (isSignupPending) {
    /*
      가입을 마치지 않아도 공개 화면은 둘러볼 수 있어야 한다.
      로비·랭킹·게임 룰까지 막아 버리면 무엇을 하는 서비스인지 보지도 못한
      채 약관부터 마주하게 된다. 실제 입장·생성은 각 화면이 따로 막는다.
    */
    const canBrowse =
      pathname.startsWith('/signup/') ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/legal/') ||
      pathname === '/' ||
      pathname === '/about' ||
      pathname === '/guide' ||
      pathname === '/lobby' ||
      pathname.startsWith('/ranking') ||
      pathname.startsWith('/rules') ||
      pathname.startsWith('/titles') ||
      pathname.startsWith('/notice') ||
      pathname === '/classic' ||
      pathname.startsWith('/classic/');

    if (canBrowse) return response;
    return NextResponse.redirect(new URL('/signup/agreement', request.url));
  }

  // 탈퇴 회원: /withdrawn 화면으로. 문의/로그아웃/약관만 허용
  if (isWithdrawn) {
    if (
      pathname === '/withdrawn' ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/support/inquiry') ||
      pathname.startsWith('/legal/')
    ) {
      return response;
    }
    return NextResponse.redirect(new URL('/withdrawn', request.url));
  }

  // 영구정지
  if (status === 'banned') {
    if (
      pathname === '/banned' ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/support/inquiry') ||
      pathname.startsWith('/legal/')
    ) {
      return response;
    }
    return NextResponse.redirect(new URL('/banned', request.url));
  }

  // 일시정지 — /suspended, 문의, 로그아웃, 약관만 허용
  if (status === 'suspended') {
    if (
      pathname === '/suspended' ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/support/inquiry') ||
      pathname.startsWith('/legal/')
    ) {
      return response;
    }
    return NextResponse.redirect(new URL('/suspended', request.url));
  }

  // ── /admin 은 관리자만 ──
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/lobby', request.url));
  }

  // ── 정상 회원이 로그인·가입·정지 화면에 들어가면 로비로 ──
  // '/' 도 로비가 홈이므로 넘긴다. /about 은 소개를 다시 볼 수 있게 열어 둔다.
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/signup/') ||
    pathname === '/banned' ||
    pathname === '/suspended'
  ) {
    return NextResponse.redirect(new URL('/lobby', request.url));
  }

  if (pathname === '/about') markIntroSeen(response);

  return response;
}

export const config = {
  /*
    정적 파일은 미들웨어를 타지 않게 제외한다.
    특히 html/txt/xml 은 검색엔진 소유확인 파일(google*.html, naver*.html)과
    각종 검증 파일이 쓰는 확장자다. 빠뜨리면 비로그인 크롤러 요청이
    /login 으로 307 리다이렉트되어 소유확인이 실패한다.
  */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|ico|woff|woff2|ttf|html|txt|xml|json)$).*)',
  ],
};
