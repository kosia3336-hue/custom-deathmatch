import type { Metadata } from 'next';
import GuideContent from './GuideContent';

/*
  소개 페이지 = 검색 유입의 대표 페이지.

  '/' 는 로그인 사용자의 로비이고, 비로그인 방문자(크롤러 포함)는 여기로 307
  리다이렉트된다. 예전에는 '/' 가 이 내용을 그대로 렌더하고 여기 canonical 도
  '/' 를 가리켜서, 두 URL 이 같은 문서가 되고 /guide 는 색인에서 흡수됐다.
  이제 자기 자신을 canonical 로 선언해 이 URL 이 대표가 된다.
*/
export const metadata: Metadata = {
  title: { absolute: '커스텀 데스매치 — 브라우저에서 즐기는 1:1 두뇌 대결' },
  description:
    '설치 없이 브라우저에서 바로 하는 1:1 심리·전략 게임. 흑과백, 인디언 홀덤, 베팅 가위바위보, 사칙연산 등을 카카오 로그인 한 번으로 즐기고 전적·랭킹·칭호를 남깁니다.',
  alternates: { canonical: '/guide' },
};

export const revalidate = 300;

export default function GuidePage() {
  return <GuideContent />;
}
