import type { NextResponse } from 'next/server';

/** 소개 페이지를 한 번이라도 본 뒤에 심는 쿠키. 미들웨어가 '/' 첫 진입 분기에 쓴다. */
export const INTRO_SEEN_COOKIE = 'cdm_seen_intro';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function hasSeenIntro(cookies: { get(name: string): { value: string } | undefined }): boolean {
  return cookies.get(INTRO_SEEN_COOKIE)?.value === '1';
}

export function markIntroSeen(response: NextResponse) {
  response.cookies.set(INTRO_SEEN_COOKIE, '1', {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });
}
