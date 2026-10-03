'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { RANK_TIER_LABEL } from '@/lib/rankedRoomTitle';
import { calcRankRpParts, rankTierNumericForRp } from '@shared/types/rank';
import RankMatchHistoryPanel from './RankMatchHistoryPanel';

const GRANT_TIERS = ['bronze', 'silver', 'gold', 'diamond', 'challenger'] as const;
type GrantTier = (typeof GRANT_TIERS)[number];

const SELECT_CLASS =
  'mt-1 h-10 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg focus:outline-none focus:ring-2 focus:ring-cdm-primary/50';

function isGrantTier(tier: string | null): tier is GrantTier {
  return GRANT_TIERS.some((t) => t === tier);
}

function clampStreak(n: number | null): number {
  if (n == null || !Number.isFinite(n) || n < 0) return 0;
  return Math.min(6, Math.trunc(n));
}

function subjectMarker(label: string): '이' | '가' {
  const last = [...label].at(-1) ?? '';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '가';
  return (code - 0xac00) % 28 === 0 ? '가' : '이';
}

function rowTierLabel(row: SearchRow): string {
  if (isGrantTier(row.tier)) return RANK_TIER_LABEL[row.tier];
  if (!row.placementDone) return '배치';
  if (row.tier === 'unranked') return RANK_TIER_LABEL.unranked;
  return row.tier ?? '?';
}

function streakOptionLabel(streak: number): string {
  if (streak <= 0) return '연승 없음';
  if (streak >= 6) return '6연승 이상 (+20)';
  if (streak === 5) return '5연승 중 (+15)';
  if (streak === 4) return '4연승 중 (+10)';
  if (streak === 3) return '3연승 중 (+6)';
  return `${streak}연승 중`;
}

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
  activeSeasonId: number | null;
}

export default function AdminRankTools({
  seasons,
  tierBins,
  activeSeasonId,
}: Props) {
  const active = useMemo(() => seasons.find((s) => s.is_active), [seasons]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<SearchRow[]>([]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<SearchRow | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<SearchRow | null>(null);
  const [deltaStr, setDeltaStr] = useState('');
  const [reason, setReason] = useState('');
  const [ownTier, setOwnTier] = useState<GrantTier>('gold');
  const [baseTier, setBaseTier] = useState<GrantTier>('gold');
  const [streak, setStreak] = useState(0);
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

  const grant = useMemo(() => {
    if (!adjustTarget) return null;
    const parts = calcRankRpParts(
      rankTierNumericForRp(ownTier, true),
      rankTierNumericForRp(baseTier, true),
      streak,
      0,
    );
    const playerShown = RANK_TIER_LABEL[ownTier];
    const opponent = RANK_TIER_LABEL[baseTier];
    const diff = rankTierNumericForRp(ownTier, true) - rankTierNumericForRp(baseTier, true);
    const rel =
      diff === 0 ? '동티어' : diff > 0 ? `${diff}단계 아래 상대` : `${-diff}단계 위 상대`;
    const streakLabel = streak >= 6 ? '6연승 이상' : `${streak}연승`;
    const breakdown =
      parts.winnerStreakBonus > 0
        ? `기본 ${parts.winnerBaseTable} + ${streakLabel} ${parts.winnerStreakBonus}`
        : `기본 ${parts.winnerBaseTable} · 연승 가산 없음`;
    return {
      gain: parts.winnerGain,
      matchup: `${playerShown} · ${opponent} 기준 · ${rel}`,
      breakdown,
      reason: `${playerShown}${subjectMarker(playerShown)} ${opponent} 기준 ${streakLabel} 승리 ${parts.winnerGain} RP`,
    };
  }, [adjustTarget, ownTier, baseTier, streak]);

  function openAdjust(row: SearchRow) {
    const tier = isGrantTier(row.tier) ? row.tier : 'bronze';
    setAdjustTarget(row);
    setOwnTier(tier);
    setBaseTier(tier);
    setStreak(clampStreak(row.winStreak));
    setDeltaStr('');
    setReason('');
    setAdjustOpen(true);
  }

  async function postDelta(delta: number, rs: string) {
    if (!adjustTarget || activeSeasonId == null) return;
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

  function submitGrant() {
    if (!grant) return;
    const typed = reason.trim();
    void postDelta(grant.gain, typed.length >= 3 ? typed : grant.reason);
  }

  function submitManual() {
    void postDelta(Number(deltaStr), reason.trim());
  }

  const maxTier = Math.max(1, ...tierBins.map((b) => b.count));

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
            {tierBins.map((b) => (
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
            <table className="w-full min-w-160 border-collapse text-left text-sm">
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
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!activeSeasonId || row.missingStats}
                          onClick={() => openAdjust(row)}
                        >
                          수동 조정
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!activeSeasonId}
                          onClick={() => {
                            setMatchTarget(row);
                            setMatchOpen(true);
                          }}
                        >
                          전적
                        </Button>
                      </div>
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

      <Modal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        title="최근 전적 · 삭제"
        /* 게임명과 점수 변화까지 한 줄에 들어가야 해서 기본(max-w-md)으로는 좁다 */
        className="max-w-4xl"
      >
        {matchTarget ? (
          <RankMatchHistoryPanel
            memberId={matchTarget.memberId}
            nickname={matchTarget.nickname}
            onChanged={() => void runSearch()}
          />
        ) : null}
      </Modal>

      <Modal open={adjustOpen} onClose={() => !busy && setAdjustOpen(false)} title="수동 RP 조정">
        {adjustTarget ? (
          <div className="space-y-3">
            <p className="text-sm text-cdm-fg">
              <span className="font-semibold">{adjustTarget.nickname}</span>{' '}
              <span className="text-cdm-fg-muted">
                ({rowTierLabel(adjustTarget)} / {adjustTarget.rp ?? '?'} RP)
              </span>
            </p>
            {grant ? (
              <div className="space-y-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-2 p-3">
                <p className="text-xs font-medium text-cdm-fg">승리 RP 지급</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-cdm-fg-muted">
                    자기 당시 티어
                    <select
                      value={ownTier}
                      onChange={(e) => setOwnTier(e.target.value as GrantTier)}
                      className={SELECT_CLASS}
                    >
                      {GRANT_TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {RANK_TIER_LABEL[tier]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-cdm-fg-muted">
                    기준 티어 (상대)
                    <select
                      value={baseTier}
                      onChange={(e) => setBaseTier(e.target.value as GrantTier)}
                      className={SELECT_CLASS}
                    >
                      {GRANT_TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {RANK_TIER_LABEL[tier]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 block text-xs font-medium text-cdm-fg-muted">
                    연승
                    <select
                      value={streak}
                      onChange={(e) => setStreak(Number(e.target.value))}
                      className={SELECT_CLASS}
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {streakOptionLabel(n)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-cdm-fg-muted">
                  현재 {rowTierLabel(adjustTarget)} · {adjustTarget.winStreak ?? 0}연승
                </p>
                <p className="text-sm text-cdm-fg">{grant.matchup}</p>
                <p className="text-lg font-semibold tabular-nums text-cdm-fg">{grant.gain} RP</p>
                <p className="text-xs text-cdm-fg-muted">{grant.breakdown}</p>
                <p className="text-xs text-cdm-fg-muted">전적과 연승은 바꾸지 않고 RP만 더합니다.</p>
              </div>
            ) : null}
            <label className="block text-xs font-medium text-cdm-fg-muted">
              사유 (감사 로그)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={grant?.reason}
                className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg"
              />
              <span className="mt-1 block font-normal">
                지급은 비워도 됩니다. 직접 가감은 3자 이상 적어야 합니다.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setAdjustOpen(false)}>
                취소
              </Button>
              <Button type="button" disabled={busy || !grant} onClick={submitGrant}>
                {grant ? `${grant.gain} RP 지급` : '지급'}
              </Button>
            </div>
            <label className="block border-t border-cdm-border pt-3 text-xs font-medium text-cdm-fg-muted">
              직접 가감 (+/- 정수)
              <Input
                value={deltaStr}
                onChange={(e) => setDeltaStr(e.target.value)}
                placeholder="예: -10 또는 25"
                className="mt-1"
              />
            </label>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" disabled={busy} onClick={submitManual}>
                입력값 적용
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
