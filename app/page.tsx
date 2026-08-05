import type { Metadata } from 'next';
import GNB from '@/components/layout/GNB';
import MainBillboard from '@/components/lobby/MainBillboard';
import LobbyClient from './LobbyClient';
import { getSiteUrl, jsonLdScript } from '@/lib/site';
import { getAuthState } from '@/lib/auth/server';
import GuideContent from './guide/GuideContent';

/*
  '/' 는 로그인 사용자에게는 로비, 비로그인 방문자에게는 소개 화면을 보여준다.
  검색 크롤러는 항상 비로그인이므로 이 페이지가 곧 사이트의 대표 소개 페이지가 된다.
  (리다이렉트로 처리하면 홈이 '리다이렉트 페이지'로 분류돼 색인에서 빠지므로 같은 URL 에서 렌더한다.)
*/
export const metadata: Metadata = {
  title: { absolute: '커스텀 데스매치 — 브라우저에서 즐기는 1:1 두뇌 대결' },
  description:
    '커스텀 데스매치는 설치 없이 브라우저에서 즐기는 1:1 심리·전략 게임 플랫폼입니다. 흑과백, 인디언 홀덤, 베팅 가위바위보, 사칙연산 등 다양한 게임을 카카오 로그인 한 번으로 바로 즐기고 전적·랭킹·칭호를 쌓아보세요.',
  alternates: { canonical: '/' },
};

// 로그인 여부에 따라 화면이 갈리므로 요청 시점에 렌더
export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const auth = await getAuthState();
  if (auth.kind === 'LOGGED_OUT') {
    return <GuideContent />;
  }

  const siteUrl = getSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '커스텀 데스매치',
    alternateName: 'Custom Deathmatch',
    url: siteUrl,
    description: '브라우저에서 바로 즐기는 1:1 보드/카드 게임 플랫폼.',
    inLanguage: 'ko-KR',
  };

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB />

      <h1 className="sr-only">커스텀 데스매치 — 브라우저 1:1 보드·카드 게임 플랫폼</h1>
      <p className="sr-only">
        카카오 로그인 후 로비에서 방을 만들거나 참여해 흑과백, 인디안 포커, 사칙연산, 베팅 가위바위보 등 다양한 1:1 보드·카드 게임을 즐길 수 있습니다. 게임 로그·랭킹·칭호를 지원합니다.
      </p>

      {/* 히어로 — GNB 와 이어지는 다크 섹션 */}
      <section className="bg-cdm-ink py-1">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <MainBillboard />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <LobbyClient />
      </main>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
    </div>
  );
}
