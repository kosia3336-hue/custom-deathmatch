'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts';
import { Card } from '@/components/cdm/Card';

const C_PRIMARY = '#4f46e5';
const C_ACCENT  = '#f43f5e';
const C_MUTED   = '#64748b';
const C_BORDER  = '#e2e8f0';

export type BanPickLogRow = {
  pickedGameId: string;
  seasonId: number;
  bans: { gameId: string; bannedBy: string; isTimeout: boolean }[];
};

interface Props {
  games: { id: string; name: string }[];
  seasons: { id: number; name: string; isActive: boolean }[];
  banPickLogs: BanPickLogRow[];
}

const Y_WIDTH = 118;
const BAR_H   = 34;

export default function GameStatsCharts({ games, seasons, banPickLogs }: Props) {
  const [mounted, setMounted] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>('all');

  useEffect(() => { setMounted(true); }, []);

  const { pickData, banData, tableData, expectedPct } = useMemo(() => {
    const filtered = seasonFilter === 'all'
      ? banPickLogs
      : banPickLogs.filter((l) => l.seasonId === seasonFilter);

    const pickMap = new Map<string, number>();
    const banMap  = new Map<string, number>();

    for (const log of filtered) {
      pickMap.set(log.pickedGameId, (pickMap.get(log.pickedGameId) ?? 0) + 1);
      for (const ban of log.bans) {
        banMap.set(ban.gameId, (banMap.get(ban.gameId) ?? 0) + 1);
      }
    }

    const totalPicks = filtered.length;
    const totalBans  = [...banMap.values()].reduce((a, b) => a + b, 0);
    const expected   = +(100 / Math.max(games.length, 1)).toFixed(1);

    const rows = games.map((g) => {
      const p = pickMap.get(g.id) ?? 0;
      const b = banMap.get(g.id)  ?? 0;
      return {
        name:         g.name,
        pickCount:    p,
        banCount:     b,
        pickPct:      totalPicks > 0 ? +(p / totalPicks * 100).toFixed(1) : 0,
        banPct:       totalBans  > 0 ? +(b / totalBans  * 100).toFixed(1) : 0,
        survivalRate: (p + b) > 0    ? +(p / (p + b)   * 100).toFixed(1) : null,
      };
    });

    return {
      pickData:    [...rows].sort((a, b) => b.pickPct - a.pickPct).map((r) => ({ name: r.name, value: r.pickPct })),
      banData:     [...rows].sort((a, b) => b.banPct  - a.banPct ).map((r) => ({ name: r.name, value: r.banPct  })),
      tableData:   [...rows].sort((a, b) => b.pickPct - a.pickPct),
      expectedPct: expected,
    };
  }, [games, banPickLogs, seasonFilter]);

  const bpH = games.length * BAR_H + 20;

  const skeleton = (h: number) => (
    <div className="animate-pulse rounded bg-cdm-bg-elev-2" style={{ height: h }} />
  );

  return (
    <div className="space-y-8">

      {/* ── 밴픽 통계 (랭크) ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-cdm-fg">밴픽 통계 (랭크)</h2>
          <select
            value={String(seasonFilter)}
            onChange={(e) =>
              setSeasonFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="rounded-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-1.5 text-sm text-cdm-fg"
          >
            <option value="all">전체 시즌</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isActive ? ' (현재)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 픽률 */}
          <Card>
            <p className="text-xs font-semibold text-cdm-fg-muted">픽률</p>
            <p className="mb-3 text-xs text-cdm-fg-subtle">점선 = 균등 기대값 {expectedPct}%</p>
            {!mounted ? skeleton(bpH) : (
              <ResponsiveContainer width="100%" height={bpH}>
                <BarChart data={pickData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C_BORDER} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={Y_WIDTH} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}%`, '픽률']} />
                  <ReferenceLine x={expectedPct} stroke={C_MUTED} strokeDasharray="4 4" />
                  <Bar dataKey="value" fill={C_PRIMARY} radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: unknown) => `${v}%`}
                      style={{ fontSize: 11, fill: C_MUTED }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* 밴률 */}
          <Card>
            <p className="text-xs font-semibold text-cdm-fg-muted">밴률</p>
            <p className="mb-3 text-xs text-cdm-fg-subtle">점선 = 균등 기대값 {expectedPct}%</p>
            {!mounted ? skeleton(bpH) : (
              <ResponsiveContainer width="100%" height={bpH}>
                <BarChart data={banData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C_BORDER} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={Y_WIDTH} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}%`, '밴률']} />
                  <ReferenceLine x={expectedPct} stroke={C_MUTED} strokeDasharray="4 4" />
                  <Bar dataKey="value" fill={C_ACCENT} radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: unknown) => `${v}%`}
                      style={{ fontSize: 11, fill: C_MUTED }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* 수치 테이블 — sm 이상 */}
        <Card className="mt-4 hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cdm-border text-left text-xs text-cdm-fg-muted">
                <th className="pb-2 pr-4 font-medium">게임</th>
                <th className="pb-2 pr-3 font-medium text-right">픽</th>
                <th className="pb-2 pr-4 font-medium text-right">픽률</th>
                <th className="pb-2 pr-3 font-medium text-right">밴</th>
                <th className="pb-2 pr-4 font-medium text-right">밴률</th>
                <th className="pb-2 font-medium text-right">생존률</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.name} className="border-b border-cdm-border last:border-0">
                  <td className="py-2 pr-4 font-medium">{row.name}</td>
                  <td className="py-2 pr-3 tabular-nums text-right text-cdm-fg-muted">{row.pickCount}</td>
                  <td className="py-2 pr-4 tabular-nums text-right font-semibold text-cdm-primary">{row.pickPct}%</td>
                  <td className="py-2 pr-3 tabular-nums text-right text-cdm-fg-muted">{row.banCount}</td>
                  <td className="py-2 pr-4 tabular-nums text-right font-semibold text-cdm-accent">{row.banPct}%</td>
                  <td className="py-2 tabular-nums text-right">
                    {row.survivalRate !== null ? `${row.survivalRate}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* 수치 카드 — sm 미만 */}
        <div className="mt-4 flex flex-col gap-2 sm:hidden">
          {tableData.map((row) => (
            <Card key={row.name}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-cdm-fg">{row.name}</span>
                <span className="text-xs text-cdm-fg-muted">
                  생존률{' '}
                  <span className="font-medium text-cdm-fg">
                    {row.survivalRate !== null ? `${row.survivalRate}%` : '-'}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-cdm-fg-muted">픽</span>
                  <span className="tabular-nums">
                    {row.pickCount}회{' '}
                    <span className="font-semibold text-cdm-primary">{row.pickPct}%</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cdm-fg-muted">밴</span>
                  <span className="tabular-nums">
                    {row.banCount}회{' '}
                    <span className="font-semibold text-cdm-accent">{row.banPct}%</span>
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

    </div>
  );
}
