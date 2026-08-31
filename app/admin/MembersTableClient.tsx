'use client';

import { useRouter } from 'next/navigation';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { MemberStatusChip } from '@/components/cdm/StatusChip';
import { RankBadge } from '@/components/cdm/RankBadge';
import { RoutePagination } from '@/components/cdm/Pagination';
import { formatCdp } from '@/lib/cdp/format';
import type { MemberStatus, TitleColor } from '@/lib/supabase/database.types';
import type { RankTier } from '@/shared/types/rank';
import { AdminGuildLabel } from './AdminGuildLabel';
import type { AdminMemberGuild } from './fetchMemberGuilds';

export interface MemberTableRow {
  id: string;
  nickname: string;
  created_at: string;
  status: MemberStatus;
  role: 'user' | 'admin';
  title: { name: string; color: TitleColor } | null;
  tier: RankTier;
  rp: number;
  cdp: number;
  totalGames: number;
  guild: AdminMemberGuild | null;
}

export function MembersTableClient({
  members,
  totalCount,
  totalPages,
}: {
  members: MemberTableRow[];
  totalCount: number;
  totalPages: number;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-cdm-fg-muted">총 {totalCount.toLocaleString('ko-KR')}명</p>
      <div className="overflow-x-auto rounded-cdm-lg border border-cdm-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-cdm-border bg-cdm-bg-elev-1 text-left text-xs font-semibold text-cdm-fg-muted">
              <th className="px-3 py-2.5">닉네임</th>
              <th className="px-3 py-2.5">길드</th>
              <th className="px-3 py-2.5">티어</th>
              <th className="px-3 py-2.5 text-right">CDP</th>
              <th className="hidden sm:table-cell px-3 py-2.5 text-right">전적</th>
              <th className="hidden md:table-cell px-3 py-2.5 text-right">가입일</th>
              <th className="w-6 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-cdm-border last:border-0 cursor-pointer transition-colors hover:bg-cdm-bg-elev-1"
                onClick={() => router.push(`/admin/members/${m.id}`)}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {m.title && (
                      <TitleBadge name={m.title.name} color={m.title.color} size="sm" />
                    )}
                    <span className="font-semibold text-cdm-fg truncate">{m.nickname}</span>
                    {m.status !== 'active' && <MemberStatusChip status={m.status} />}
                    {m.role === 'admin' && (
                      <span className="rounded-cdm-sm bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                        ADMIN
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <AdminGuildLabel guild={m.guild} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <RankBadge tier={m.tier} rp={m.rp} size="sm" showRp={m.tier !== 'unranked'} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-cdm-fg-muted whitespace-nowrap">
                  {formatCdp(m.cdp)}
                </td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-cdm-fg-muted">
                  {m.totalGames.toLocaleString('ko-KR')}
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-right text-cdm-fg-muted whitespace-nowrap">
                  {new Date(m.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-2 py-2.5 text-cdm-fg-subtle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
