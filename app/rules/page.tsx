import type { Metadata } from 'next';
import GNB from '@/components/layout/GNB';
import RulesClient from './RulesClient';

export const metadata: Metadata = { title: '게임 룰' };

export default function RulesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">게임 룰</h1>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            게임을 눌러 룰을 확인하세요.
          </p>
        </div>
        <RulesClient />
      </main>
    </div>
  );
}
