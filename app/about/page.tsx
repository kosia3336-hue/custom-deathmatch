import type { Metadata, Viewport } from 'next';
import IntroContent from '@/components/intro/IntroContent';

/*
  사이트 소개. 검색·신규 유입의 대표 문서다.

  '/' 는 로비로 보내는 입구다. 비로그인 첫 방문만 여기로 오고,
  소개를 본 뒤(쿠키)나 로그인한 뒤에는 '/' → /lobby.
  옛 주소 /guide 는 여기로 308 이동한다.
*/
export const metadata: Metadata = {
  title: { absolute: '커스텀 데스매치 — 브라우저에서 즐기는 1:1 두뇌 대결' },
  description:
    '설치 없이 브라우저에서 바로 하는 1:1 심리·전략 게임. 흑과백, 인디언 홀덤, 베팅 가위바위보, 사칙연산 등을 카카오 로그인 한 번으로 즐기고 전적·랭킹·칭호를 남깁니다.',
  alternates: { canonical: '/about' },
};

/*
  소개는 화면 한 칸짜리 섹션이라, 스크롤의 첫 구간이 문서가 아니라
  모바일 주소창(visual viewport) 밀림으로 쓰인다. 기본값(resizes-visual)이면
  헤더·하단 GNB 가 화면 밖으로 밀려 가려진다. 로비는 목록이 길어 문서 스크롤이
  바로 잡혀 같은 증상이 거의 없다.
*/
export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function AboutPage() {
  return <IntroContent />;
}
