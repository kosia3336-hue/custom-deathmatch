import type { Metadata } from 'next';
import GNB from '@/components/layout/GNB';
import MainBillboard from '@/components/lobby/MainBillboard';
import LobbyClient from './LobbyClient';

/*
  로비 — 방 목록/생성 화면. 로그인 없이도 둘러볼 수 있고, 실제 입장·생성 시점에
  로그인을 요구한다(소개 페이지 /about 의 '로비로 가기'가 여기로 온다).

  색인은 하지 않는다. 방 목록은 매 순간 바뀌는 앱 화면이라 검색 결과에 올릴
  내용이 없고, 대표 문서인 '/about'(소개)과 브랜드 질의를 두고 경쟁만 한다.
  크롤은 막지 않으므로 여기서 나가는 링크는 그대로 따라간다.
*/
export const metadata: Metadata = {
  title: '로비',
  robots: { index: false, follow: true },
  alternates: { canonical: '/lobby' },
};

// 방 목록은 접속 시점 상태라 캐시하지 않는다
export const dynamic = 'force-dynamic';

export default function LobbyPage() {
  return (
    <div className="flex flex-1 flex-col bg-cdm-page">
      <GNB />

      <h1 className="sr-only">커스텀 데스매치 로비</h1>

      {/* 히어로 — GNB 와 이어지는 다크 섹션.
          모바일은 앱 재설계안의 랭크 카드 헤더가 이 자리를 대신하므로 감춘다. */}
      <section className="hidden bg-cdm-ink py-1 sm:block">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <MainBillboard />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <LobbyClient />
      </main>
    </div>
  );
}
