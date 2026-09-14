import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { CONTAINER_READ } from '@/lib/layout';
import SunMoonStar2AdvisorClient from './SunMoonStar2AdvisorClient';

export const metadata: Metadata = {
  title: '해달별2 자문',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function SuperAiSunMoonStar2Page() {
  const member = await getActiveMember();
  if (!member) redirect('/login?next=/super-ai/sun-moon-star-2');

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB member={member} />
      <main className={`${CONTAINER_READ} flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10`}>
        <SunMoonStar2AdvisorClient />
      </main>
    </div>
  );
}
