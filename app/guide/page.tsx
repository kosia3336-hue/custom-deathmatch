import type { Metadata } from 'next';
import GuideContent from './GuideContent';

/*
  같은 내용이 비로그인 방문자에게 '/' 로도 노출된다(app/page.tsx).
  대표 URL(canonical)은 '/' 로 모아 중복 색인을 피한다.
*/
export const metadata: Metadata = {
  title: '시작 가이드',
  description:
    '커스텀 데스매치 시작 가이드 — 카카오 로그인 후 로비에서 방을 만들고, 흑과백·인디언 홀덤·베팅 가위바위보 등 다양한 1:1 심리·전략 게임을 즐기는 방법을 안내합니다.',
  alternates: { canonical: '/' },
};

export const revalidate = 300;

export default function GuidePage() {
  return <GuideContent />;
}
