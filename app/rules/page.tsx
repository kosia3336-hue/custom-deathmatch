import type { Metadata } from 'next';
import GNB from '@/components/layout/GNB';
import { getActiveMember } from '@/lib/auth/server';
import RulesClient from './RulesClient';
import { CONTAINER_READ } from '@/lib/layout';

export const metadata: Metadata = {
  title: '게임 룰',
  description: '커스텀 데스매치의 게임 룰 목록. 심리·추상전략·수리·언어·관찰 갈래별로 게임을 골라 룰을 확인하세요.',
  alternates: { canonical: '/rules' },
};

export default async function RulesPage() {
  /* 출시 전 게임은 관리자에게만 보인다 (lib/unreleasedGames.ts) */
  const member = await getActiveMember();
  const isAdmin = member?.role === 'admin';

  return (
    <div className="flex flex-1 flex-col bg-cdm-page">
      <GNB />
      <main className={`${CONTAINER_READ} flex-1 p-4 md:p-6`}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">게임 룰</h1>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            게임을 눌러 룰을 확인하세요.
          </p>
        </div>
        <RulesClient isAdmin={isAdmin} />
      </main>
    </div>
  );
}
