import type { Metadata } from 'next';
import GNB from '@/components/layout/GNB';
import LobbyClient from './LobbyClient';
import { getSiteUrl } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function LobbyPage() {
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
    <div className="flex min-h-screen flex-col bg-cdm-bg">
      <GNB />

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <h1 className="sr-only">커스텀 데스매치 — 브라우저 1:1 보드·카드 게임 플랫폼</h1>
        <p className="sr-only">
          카카오 로그인 후 로비에서 방을 만들거나 참여해 흑과백, 인디안 포커, 사칙연산, 베팅 가위바위보 등 다양한 1:1 보드·카드 게임을 즐길 수 있습니다. 게임 로그·랭킹·칭호를 지원합니다.
        </p>

        <LobbyClient />
      </main>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
