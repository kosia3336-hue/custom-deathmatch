import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { listGuilds, getMyGuildState } from '@/lib/guild/server';
import GuildClient from './GuildClient';

export const metadata: Metadata = { title: '길드' };
export const dynamic = 'force-dynamic';

export default async function GuildPage() {
  const member = await getActiveMember();
  if (!member) redirect('/login?next=/guild');

  if (!isSupabaseServiceRoleConfigured()) {
    return (
      <div className="flex flex-1 flex-col bg-cdm-page">
        <GNB member={member} />
        <main className="mx-auto w-full max-w-4xl px-4 py-10 text-sm text-cdm-fg-muted">
          서비스 설정이 없습니다.
        </main>
      </div>
    );
  }

  const [guilds, my] = await Promise.all([listGuilds(), getMyGuildState(member.id)]);

  return (
    <div className="flex flex-1 flex-col bg-cdm-page">
      <GNB member={member} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <GuildClient initialGuilds={guilds} initialMy={my} myMemberId={member.id} />
      </main>
    </div>
  );
}
