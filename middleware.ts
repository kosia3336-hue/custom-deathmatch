import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

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
/**
 * Supabase 세션 쿠키(sb-<ref>-auth-token, 길면 .0/.1 로 쪼개짐)가 하나라도 있는지.
 * 크롤러·첫 방문자는 쿠키가 아예 없고, 로그인 왕복 중인 사용자는 남아 있다.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
}

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
  // 소개(/guide), 랭킹(/ranking), 공지(/notice), 룰(/rules), 약관(/legal/*) 등은
  // 로그인 없이도 볼 수 있다.
  // 홈(/)은 로비(앱 화면)이므로 비로그인 방문자는 소개 페이지로 보낸다.
  // 예전에는 '/' 가 소개 내용을 그대로 렌더했는데, 그러면 '/' 와 '/guide' 가 같은
  // 문서가 되어 소개 페이지가 곧 메인으로 색인되고 /guide 는 중복으로 흡수됐다.
  // 방 입장·마이페이지 등 로그인이 필요한 액션은 /login 으로 보낸다(로그인 후 원래 위치로 복귀).
  if (!user) {
    // 인증 쿠키가 남아 있으면 토큰 갱신 직후일 수 있어 그대로 통과시킨다 —
    // 로그인 왕복 중에 소개 페이지로 튕기지 않게 하는 안전장치.
    if (pathname === '/' && !hasAuthCookie(request)) {
      // 307(임시). 로그인 사용자에게는 '/' 가 실제 로비이므로 영구 이동이 아니다.
      return NextResponse.redirect(new URL('/guide', request.url));
    }

    const isPublic =
      pathname === '/' ||
      pathname === '/guide' ||
      pathname === '/login' ||
      pathname.startsWith('/auth/') ||
      pathname === '/banned' ||
      pathname === '/suspended' ||
      pathname.startsWith('/legal/') ||
      pathname.startsWith('/ranking') ||
      pathname.startsWith('/notice') ||
      pathname.startsWith('/titles') ||
      pathname.startsWith('/rules') ||
      pathname.startsWith('/support/inquiry');

    if (isPublic) return response;

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
    if (
      pathname.startsWith('/signup/') ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/legal/')
    ) {
      return response;
    }
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
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── 정상 회원이 /login, /signup, /banned, /suspended 들어가면 홈으로 ──
  if (
    pathname === '/login' ||
    pathname.startsWith('/signup/') ||
    pathname === '/banned' ||
    pathname === '/suspended'
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

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
