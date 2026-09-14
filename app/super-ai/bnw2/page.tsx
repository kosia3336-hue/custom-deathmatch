import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { CONTAINER_READ } from '@/lib/layout';
import Bnw2AdvisorClient from './Bnw2AdvisorClient';

export const metadata: Metadata = {
  title: '흑과백2 자문',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function SuperAiBnw2Page() {
  const member = await getActiveMember();
  if (!member) redirect('/login?next=/super-ai/bnw2');

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB member={member} />
      <main className={`${CONTAINER_READ} flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10`}>
        <Bnw2AdvisorClient />
      </main>
    </div>
  );
}
