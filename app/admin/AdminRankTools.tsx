'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

export interface AdminSeasonRow {
  id: number;
  name: string;
  is_active: boolean | null;
  started_at: string;
  ended_at: string | null;
}

interface TierBin {
  tier: string;
  label: string;
  count: number;
}

interface SearchRow {
  memberId: string;
  nickname: string;
  tier: string | null;
  rp: number | null;
  winStreak: number | null;
  placementDone: boolean;
  seasonWins: number | null;
  seasonLosses: number | null;
  missingStats: boolean;
}

interface Props {
  seasons: AdminSeasonRow[];
  tierBins: TierBin[];
  challengerSlots: number;
  activeSeasonId: number | null;
}

export default function AdminRankTools({
  seasons,
  tierBins,
  challengerSlots,
  activeSeasonId,
}: Props) {
  const active = useMemo(() => seasons.find((s) => s.is_active), [seasons]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<SearchRow[]>([]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<SearchRow | null>(null);
  const [deltaStr, setDeltaStr] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [newSeasonOpen, setNewSeasonOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');

  async function postSeasonEnd(seasonId: number) {
    if (
      !window.confirm(
        `시즌 ID ${seasonId} 을(를) 종료합니다. 모든 플레이어 랭크가 리셋됩니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/rank/season/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? '실패');
      toast.success('시즌이 종료되었습니다.');
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function postSeasonStart() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/rank/season/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSeasonName.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? '실패');
      toast.success(`새 시즌이 시작되었습니다. (ID ${j.seasonId})`);
      setNewSeasonOpen(false);
      setNewSeasonName('');
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      toast.error('닉네임을 2자 이상 입력하세요.');
      return;
    }
    setSearching(true);
    try {
      const r = await fetch('/api/admin/rank/members/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? '검색 실패');
      setRows(j.rows ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function submitAdjust() {
    if (!adjustTarget || activeSeasonId == null) return;
    const delta = Number(deltaStr);
    const rs = reason.trim();
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('변경량(RP)을 입력하세요.');
      return;
    }
    if (rs.length < 3) {
      toast.error('사유를 3자 이상 입력하세요.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/rank/members/adjust-rp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: adjustTarget.memberId,
          seasonId: activeSeasonId,
          delta,
          reason: rs,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? '적용 실패');
      toast.success('RP가 조정되었습니다.');
      setAdjustOpen(false);
      setAdjustTarget(null);
      setDeltaStr('');
      setReason('');
      await runSearch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const allBins = [
    ...tierBins,
    { tier: 'challenger', label: '챌린저', count: challengerSlots },
  ];
  const maxTier = Math.max(1, ...allBins.map((b) => b.count));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-cdm-fg">시즌 관리</h2>
        {active ? (
          <Card>
            <p className="font-medium text-cdm-fg">
              현재 시즌: {active.name}{' '}
              <span className="rounded-full bg-cdm-primary/15 px-2 py-0.5 text-xs text-cdm-primary">
                진행 중
              </span>
            </p>
            <p className="mt-1 text-xs text-cdm-fg-muted">
              ID {active.id} · 시작{' '}
              {new Date(active.started_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => postSeasonEnd(active.id)}
              >
                시즌 종료
              </Button>
            </div>
          </Card>
        ) : (
          <p className="text-sm text-cdm-fg-muted">진행 중인 시즌이 없습니다. 새 시즌을 시작하세요.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !!active}
            onClick={() => setNewSeasonOpen(true)}
            title={active ? '먼저 현재 시즌을 종료하세요.' : undefined}
          >
            새 시즌 시작
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg">현재 시즌 티어 분포</h2>
        {!active ? (
          <p className="text-xs text-cdm-fg-muted">활성 시즌이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {allBins.map((b) => (
              <div key={b.tier} className="flex items-center gap-2 text-sm">
                <span className={`w-24 shrink-0 ${b.tier === 'challenger' ? 'text-purple-600 dark:text-purple-400' : 'text-cdm-fg-muted'}`}>
                  {b.label}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-cdm-bg-elev-2">
                  <div
                    className="h-full bg-cdm-primary"
                    style={{ width: `${(b.count / maxTier) * 100}%` }}
                  />
                </div>
                <span className="w-10 tabular-nums text-right text-cdm-fg">{b.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg">플레이어 RP 조회 · 수동 조정</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임 검색"
            className="max-w-xs"
          />
          <Button type="button" variant="secondary" loading={searching} onClick={runSearch}>
            검색
          </Button>
        </div>

        {rows.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-cdm-border text-xs text-cdm-fg-muted">
                  <th className="py-2 pr-2">닉네임</th>
                  <th className="py-2 pr-2">티어</th>
                  <th className="py-2 pr-2">RP</th>
                  <th className="py-2 pr-2">시즌 전적</th>
                  <th className="py-2 pr-2">스트릭</th>
                  <th className="py-2">조치</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.memberId} className="border-b border-cdm-border/80">
                    <td className="py-2 pr-2 font-medium">{row.nickname}</td>
                    <td className="py-2 pr-2">{row.tier ?? '—'}</td>
                    <td className="py-2 pr-2 tabular-nums">{row.rp ?? '—'}</td>
                    <td className="py-2 pr-2">
                      {row.seasonWins != null ? `${row.seasonWins}승 ${row.seasonLosses ?? 0}패` : '—'}
                    </td>
                    <td className="py-2 pr-2">
                      {row.placementDone ? `${row.winStreak ?? 0}연승` : '배치전'}
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!activeSeasonId || row.missingStats}
                        onClick={() => {
                          setAdjustTarget(row);
                          setAdjustOpen(true);
                        }}
                      >
                        수동 조정
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg">시즌 목록</h2>
        <div className="flex flex-col gap-2">
          {seasons.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-cdm-fg">
                    {s.name}
                    {s.is_active ? (
                      <span className="ml-2 rounded-full bg-cdm-primary/15 px-2 py-0.5 text-xs text-cdm-primary">
                        진행 중
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-cdm-fg-muted">
                    ID {s.id} · 시작{' '}
                    {new Date(s.started_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    {s.ended_at
                      ? ` · 종료 ${new Date(s.ended_at).toLocaleString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                        })}`
                      : ''}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Modal open={adjustOpen} onClose={() => !busy && setAdjustOpen(false)} title="수동 RP 조정">
        {adjustTarget ? (
          <div className="space-y-3">
            <p className="text-sm text-cdm-fg">
              <span className="font-semibold">{adjustTarget.nickname}</span>{' '}
              <span className="text-cdm-fg-muted">
                ({adjustTarget.tier ?? '?'} / {adjustTarget.rp ?? '?'} RP)
              </span>
            </p>
            <label className="block text-xs font-medium text-cdm-fg-muted">
              RP 변경량 (+/- 정수)
              <Input
                value={deltaStr}
                onChange={(e) => setDeltaStr(e.target.value)}
                placeholder="예: -10 또는 25"
                className="mt-1"
              />
            </label>
            <label className="block text-xs font-medium text-cdm-fg-muted">
              사유 (감사 로그)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setAdjustOpen(false)}>
                취소
              </Button>
              <Button type="button" disabled={busy} onClick={submitAdjust}>
                적용
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={newSeasonOpen} onClose={() => !busy && setNewSeasonOpen(false)} title="새 시즌 시작">
        <p className="mb-3 text-sm text-cdm-fg-muted">
          진행 중인 시즌이 없을 때만 시작할 수 있습니다. 이름을 비우면 “시즌 N”으로 생성됩니다.
        </p>
        <label className="block text-xs font-medium text-cdm-fg-muted">
          시즌 이름 (선택)
          <Input
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            placeholder="예: 시즌 2"
            className="mt-1"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setNewSeasonOpen(false)}>
            취소
          </Button>
          <Button type="button" disabled={busy} onClick={postSeasonStart}>
            시작
          </Button>
        </div>
      </Modal>
    </div>
  );
}
