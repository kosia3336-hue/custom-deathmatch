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
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Supabase 미설정 시 통과 (개발 초기)
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  // ── 정적 / API / 시스템 라우트 ─────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const { updateSession } = await import('@/lib/supabase/middleware');
  const { response, user } = await updateSession(request);

  // ── 비로그인 ────────────────────────────────────────────────
  // 로비(/)와 랭킹(/ranking), 공지(/notice), 약관(/legal/*) 은 로그인 없이도 볼 수 있다.
  // 방 입장·마이페이지 등 로그인이 필요한 액션은 각 페이지/컴포넌트에서 /login 으로 보낸다.
  if (!user) {
    const isPublic =
      pathname === '/' ||
      pathname === '/login' ||
      pathname.startsWith('/auth/') ||
      pathname === '/banned' ||
      pathname === '/suspended' ||
      pathname.startsWith('/legal/') ||
      pathname.startsWith('/ranking') ||
      pathname.startsWith('/notice') ||
      pathname.startsWith('/titles') ||
      pathname.startsWith('/support/inquiry');

    if (isPublic) return response;

    const login = new URLSearchParams({ next: pathname });
    return NextResponse.redirect(`/login?${login}`);
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

  const memberRes = await sb
    .from('members')
    .select('id, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle();
  const memberRow = memberRes.data as unknown as { id: string; withdrawn_at: string | null } | null;

  const isWithdrawn = !!memberRow?.withdrawn_at;
  const isSignupPending = !memberRow && !isWithdrawn;

  let status: 'active' | 'suspended' | 'banned' | undefined;
  let role: 'user' | 'admin' | undefined;
  if (memberRow && !isWithdrawn) {
    const privRes = await sb
      .from('members_private')
      .select('status, role')
      .eq('member_id', user.id)
      .maybeSingle();
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
    return NextResponse.redirect('/signup/agreement');
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
    return NextResponse.redirect('/withdrawn');
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
    return NextResponse.redirect('/banned');
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
    return NextResponse.redirect('/suspended');
  }

  // ── /admin 은 관리자만 ──
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect('/');
  }

  // ── 정상 회원이 /login, /signup, /banned, /suspended 들어가면 홈으로 ──
  if (
    pathname === '/login' ||
    pathname.startsWith('/signup/') ||
    pathname === '/banned' ||
    pathname === '/suspended'
  ) {
    return NextResponse.redirect('/');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
