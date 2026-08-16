import { redirect } from 'next/navigation';

/*
  '/' 는 입구만 담당한다. 실제 분기는 middleware:
    비로그인 + 소개 미열람 → /about
    그 외(소개를 본 게스트, 로그인 회원) → /lobby

  미들웨어가 건너뛰는 경우(Supabase 미설정 등)의 폴백.
*/
export default function HomePage() {
  redirect('/lobby');
}
