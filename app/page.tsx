import type { Metadata } from 'next';
import IntroContent from '@/components/intro/IntroContent';

/*
  '/' 는 사이트의 대표(소개) 페이지다. 로비는 /lobby 에 따로 있다.

  한동안 '/' 가 로그인 여부에 따라 소개/로비를 갈라 렌더했는데, 그러면 '/' 와
  '/guide' 가 같은 문서가 되어 소개 페이지가 중복 색인되고 로비는 크롤러에게
  아예 없는 페이지가 됐다. 지금은 URL 이 역할별로 하나씩이라 리다이렉트 없이
  '/' 가 그대로 200 으로 색인된다.
*/
export const metadata: Metadata = {
  title: { absolute: '커스텀 데스매치 — 브라우저에서 즐기는 1:1 두뇌 대결' },
  description:
    '설치 없이 브라우저에서 바로 하는 1:1 심리·전략 게임. 흑과백, 인디언 홀덤, 베팅 가위바위보, 사칙연산 등을 카카오 로그인 한 번으로 즐기고 전적·랭킹·칭호를 남깁니다.',
  alternates: { canonical: '/' },
};

// 룰 본문은 관리자가 저장하면 갱신되므로 주기적 재검증
export const revalidate = 300;

export default function HomePage() {
  return <IntroContent />;
}
