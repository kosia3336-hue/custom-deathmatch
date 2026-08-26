import { Card } from '@/components/cdm/Card';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSupabaseServiceRole } from '@/lib/supabase/service-role';

async function loadCounts() {
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guildDb = getSupabaseServiceRole() as any;
  const [members, suspended, banned, pendingReports, pendingInquiries, totalLogs, todayLogs, guilds, pendingJoins] =
    await Promise.all([
      sb.from('members').select('id', { count: 'exact', head: true }).is('withdrawn_at', null),
      sb.from('members_private').select('member_id', { count: 'exact', head: true }).eq('status', 'suspended'),
      sb.from('members_private').select('member_id', { count: 'exact', head: true }).eq('status', 'banned'),
      sb.from('reports').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
      sb.from('inquiries').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing', 'replied']),
      sb.from('game_logs').select('id', { count: 'exact', head: true }),
      sb.from('game_logs').select('id', { count: 'exact', head: true }).gte('played_at', (() => { const n = new Date(Date.now() + 9 * 3600_000); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 9 * 3600_000).toISOString(); })()),
      guildDb.from('guilds').select('id', { count: 'exact', head: true }).is('disbanded_at', null),
      guildDb.from('guild_join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
  return {
    members: members.count ?? 0,
    suspended: suspended.count ?? 0,
    banned: banned.count ?? 0,
    pendingReports: pendingReports.count ?? 0,
    pendingInquiries: pendingInquiries.count ?? 0,
    totalLogs: totalLogs.count ?? 0,
    todayLogs: todayLogs.count ?? 0,
    guilds: guilds.count ?? 0,
    pendingJoins: pendingJoins.count ?? 0,
  };
}

export default async function DashboardTab() {
  const c = await loadCounts();
  const items = [
    { label: '활성 회원', value: c.members },
    { label: '일시정지', value: c.suspended },
    { label: '영구정지', value: c.banned },
    { label: '미처리 신고', value: c.pendingReports, accent: 'accent' as const },
    { label: '미처리 문의', value: c.pendingInquiries, accent: 'highlight' as const },
    { label: '게임 로그 누적', value: c.totalLogs },
    { label: '오늘 게임', value: c.todayLogs },
    { label: '활성 길드', value: c.guilds },
    { label: '길드 가입 대기', value: c.pendingJoins },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <Card
          key={it.label}
          variant={it.accent ? 'highlight' : 'default'}
          accent={it.accent}
        >
          <p className="text-xs font-semibold text-cdm-fg-muted">{it.label}</p>
          <p className="mt-1 text-2xl font-bold text-cdm-fg tabular-nums">{it.value}</p>
        </Card>
      ))}
    </div>
  );
}
