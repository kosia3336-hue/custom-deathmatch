import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import AdminGuildDetailClient, {
  type AdminGuildDetail,
  type AdminGuildLedgerRow,
  type AdminGuildMemberRow,
  type AdminGuildRequestRow,
} from './AdminGuildDetailClient';

export const metadata: Metadata = { title: '길드 상세', robots: { index: false } };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminGuildDetailPage({ params }: Props) {
  const member = await getActiveMember();
  if (!member) redirect('/login');
  if (member.role !== 'admin') redirect('/lobby');

  const { id } = await params;
  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: guild } = await db
    .from('guilds')
    .select(
      'id, name, description, owner_id, capacity, points, created_at, disbanded_at, mark_url, buff_cdp_level',
    )
    .eq('id', id)
    .maybeSingle();
  if (!guild) notFound();

  const { data: memberRows } = await db
    .from('guild_members')
    .select('member_id, role, joined_at')
    .eq('guild_id', id)
    .order('joined_at', { ascending: true });
  const members = (memberRows ?? []) as { member_id: string; role: string; joined_at: string }[];

  const { data: requestRows } = await db
    .from('guild_join_requests')
    .select('id, member_id, status, created_at')
    .eq('guild_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  const requests = (requestRows ?? []) as {
    id: string;
    member_id: string;
    status: string;
    created_at: string;
  }[];

  const { data: ledgerRows } = await db
    .from('guild_point_ledger')
    .select('id, member_id, delta, reason, created_at')
    .eq('guild_id', id)
    .lt('delta', 0)
    .order('created_at', { ascending: false })
    .limit(40);

  const nickIds = [
    ...members.map((m) => m.member_id),
    ...requests.map((r) => r.member_id),
    ...((ledgerRows ?? []) as { member_id: string | null }[])
      .map((r) => r.member_id)
      .filter((x): x is string => !!x),
    guild.owner_id as string,
  ];
  const { data: nickRows } = nickIds.length
    ? await sb.from('members').select('id, nickname').in('id', [...new Set(nickIds)])
    : { data: [] };
  const nicks = new Map(
    ((nickRows ?? []) as { id: string; nickname: string }[]).map((m) => [m.id, m.nickname]),
  );

  const detail: AdminGuildDetail = {
    id: guild.id,
    name: guild.name,
    description: guild.description ?? '',
    ownerId: guild.owner_id,
    ownerNickname: nicks.get(guild.owner_id) ?? '',
    capacity: guild.capacity,
    points: Number(guild.points),
    createdAt: guild.created_at,
    disbandedAt: guild.disbanded_at,
    markUrl: guild.mark_url,
    buffCdpLevel: Number(guild.buff_cdp_level ?? 0),
  };

  const memberList: AdminGuildMemberRow[] = members.map((m) => ({
    memberId: m.member_id,
    nickname: nicks.get(m.member_id) ?? '(알 수 없음)',
    role: m.role as AdminGuildMemberRow['role'],
    joinedAt: m.joined_at,
  }));

  const requestList: AdminGuildRequestRow[] = requests.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    nickname: nicks.get(r.member_id) ?? '(알 수 없음)',
    createdAt: r.created_at,
  }));

  const ledger: AdminGuildLedgerRow[] = (
    (ledgerRows ?? []) as {
      id: number;
      member_id: string | null;
      delta: number;
      reason: string;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    nickname: r.member_id ? (nicks.get(r.member_id) ?? '—') : '—',
    delta: Number(r.delta),
    reason: r.reason,
    createdAt: r.created_at,
  }));

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-3 text-sm">
          <Link href="/admin?tab=guilds" className="text-cdm-primary hover:underline">
            ← 길드 목록
          </Link>
        </p>
        <AdminGuildDetailClient
          guild={detail}
          members={memberList}
          requests={requestList}
          ledger={ledger}
        />
      </main>
    </>
  );
}
