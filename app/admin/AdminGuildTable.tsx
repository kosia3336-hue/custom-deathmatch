'use client';

import { useRouter } from 'next/navigation';
import { GuildMark } from '@/components/cdm/GuildMark';
import { RoutePagination } from '@/components/cdm/Pagination';

export interface AdminGuildListRow {
  id: string;
  name: string;
  markUrl: string | null;
  ownerNickname: string;
  memberCount: number;
  capacity: number;
  points: number;
  buffCdpLevel: number;
  pendingJoins: number;
  createdAt: string;
  disbandedAt: string | null;
}

export function AdminGuildTable({
  rows,
  totalCount,
  totalPages,
}: {
  rows: AdminGuildListRow[];
  totalCount: number;
  totalPages: number;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-cdm-fg-muted">총 {totalCount.toLocaleString('ko-KR')}개</p>
      <div className="overflow-x-auto rounded-cdm-lg border border-cdm-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-cdm-border bg-cdm-bg-elev-1 text-left text-xs font-semibold text-cdm-fg-muted">
              <th className="px-3 py-2.5">길드</th>
              <th className="px-3 py-2.5">길드장</th>
              <th className="px-3 py-2.5 text-right">인원</th>
              <th className="px-3 py-2.5 text-right">GP</th>
              <th className="hidden sm:table-cell px-3 py-2.5 text-right">버프</th>
              <th className="hidden md:table-cell px-3 py-2.5 text-right">신청</th>
              <th className="hidden md:table-cell px-3 py-2.5 text-right">창설</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr
                key={g.id}
                className="cursor-pointer border-b border-cdm-border last:border-0 transition-colors hover:bg-cdm-bg-elev-1"
                onClick={() => router.push(`/admin/guilds/${g.id}`)}
              >
                <td className="px-3 py-2.5">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    {g.markUrl ? (
                      <GuildMark mark={{ url: g.markUrl, name: g.name }} size="sm" />
                    ) : null}
                    <span className="truncate font-semibold text-cdm-fg">{g.name}</span>
                    {g.disbandedAt ? (
                      <span className="rounded-cdm-sm bg-cdm-bg-elev-2 px-1.5 py-0.5 text-[10px] font-bold text-cdm-fg-muted">
                        해체
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-cdm-fg-muted">{g.ownerNickname || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-cdm-fg">
                  {g.memberCount}/{g.capacity}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-cdm-fg-muted">
                  {g.points.toLocaleString('ko-KR')}
                </td>
                <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-cdm-fg-muted">
                  레벨 {g.buffCdpLevel}
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-right tabular-nums text-cdm-fg-muted">
                  {g.pendingJoins}
                </td>
                <td className="hidden md:table-cell px-3 py-2.5 text-right text-cdm-fg-muted whitespace-nowrap">
                  {new Date(g.createdAt).toLocaleDateString('ko-KR')}
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
