'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatRpChange } from '@/lib/rank/rpChange';

const PAGE_SIZE = 20;

interface MatchItem {
  id: string;
  playedAt: string;
  result: 'win' | 'loss';
  rpDelta: number;
  rpBefore: number;
  rpAfter: number;
  tierAfter: string;
  tierChanged: boolean;
  gameId: string;
  gameName: string;
  isForfeit: boolean;
  opponentName: string;
}

interface Props {
  memberId: string;
  nickname: string;
  /** 삭제 후 상위 검색 결과를 갱신하기 위한 콜백 */
  onChanged?: () => void;
}

function fmt(dt: string) {
  const d = new Date(dt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 관리자 — 특정 회원의 최근 랭크 전적 조회 및 삭제(자동 역산) */
export default function RankMatchHistoryPanel({ memberId, nickname, onChanged }: Props) {
  const [rows, setRows] = useState<MatchItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  /**
   * append 면 뒤에 잇고, 아니면 처음부터 다시 받는다.
   * 삭제 뒤에는 지금까지 펼쳐 본 만큼을 그대로 다시 받아야 화면이 접히지 않는다.
   */
  const fetchPage = useCallback(
    async (offset: number, limit: number, append: boolean) => {
      setLoading(true);
      try {
        const r = await fetch('/api/admin/rank/members/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, limit, offset }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? '조회에 실패했습니다.');
        setRows((prev) => (append ? [...prev, ...(j.rows ?? [])] : (j.rows ?? [])));
        setHasMore(Boolean(j.hasMore));
      } catch (e) {
        toast.error((e as Error).message);
        if (!append) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [memberId],
  );

  const load = useCallback(() => fetchPage(0, PAGE_SIZE, false), [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (reason.trim().length < 3) {
      toast.error('삭제 사유를 3자 이상 입력하세요.');
      return;
    }
    setBusyId(id);
    try {
      const r = await fetch('/api/admin/rank/matches/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: id, reason: reason.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? '삭제에 실패했습니다.');

      const lines = (j.results ?? []).map(
        (x: { tier: string; rp: number; winStreak: number; lossStreak: number }) =>
          `${x.tier} ${x.rp}RP · ${x.winStreak > 0 ? `${x.winStreak}연승` : x.lossStreak > 0 ? `${x.lossStreak}연패` : '연속 없음'}`,
      );
      toast.success(`전적을 삭제하고 역산했습니다. (${lines.join(' / ')})`);

      const warns: string[] = (j.results ?? []).flatMap(
        (x: { warnings?: string[] }) => x.warnings ?? [],
      );
      warns.forEach((w) => toast.warning(w));

      setConfirmId(null);
      setReason('');
      /* 펼쳐 본 만큼 그대로 다시 받는다 — 지웠다고 목록이 접히면 이어서 지우기 번거롭다. */
      await fetchPage(0, Math.min(50, Math.max(PAGE_SIZE, rows.length - 1)), false);
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-cdm-fg">
          <span className="font-semibold">{nickname}</span>
          <span className="ml-1 text-cdm-fg-muted">최근 전적 (현재 시즌)</span>
        </p>
        <Button type="button" size="sm" variant="secondary" loading={loading} onClick={() => void load()}>
          새로고침
        </Button>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="py-6 text-center text-sm text-cdm-fg-muted">전적이 없습니다.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-cdm-bg">
              <tr className="border-b border-cdm-border text-xs text-cdm-fg-muted">
                <th className="py-2 pr-2">일시</th>
                <th className="py-2 pr-2">결과</th>
                <th className="py-2 pr-2">상대</th>
                <th className="py-2 pr-2">게임</th>
                <th className="py-2 pr-2">점수 변화</th>
                <th className="py-2">조치</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-cdm-border/80 align-top">
                  <td className="py-2 pr-2 whitespace-nowrap tabular-nums">{fmt(m.playedAt)}</td>
                  <td className="py-2 pr-2">
                    <span className={m.result === 'win' ? 'font-bold text-cdm-primary' : 'text-cdm-fg-muted'}>
                      {m.result === 'win' ? '승' : '패'}
                    </span>
                    {m.isForfeit ? <span className="ml-1 text-[11px] text-cdm-fg-muted">몰수</span> : null}
                    {/* 티어 변동은 '점수 변화' 칸에 승급/강등으로 적히므로 배지는 두지 않는다 */}
                  </td>
                  <td className="py-2 pr-2">{m.opponentName}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{m.gameName}</td>
                  <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                    {formatRpChange({
                      tierAfter: m.tierAfter,
                      rpBefore: m.rpBefore,
                      rpAfter: m.rpAfter,
                      rpDelta: m.rpDelta,
                      won: m.result === 'win',
                      tierChanged: m.tierChanged,
                    })}
                  </td>
                  <td className="py-2">
                    {confirmId === m.id ? (
                      <div className="flex flex-col gap-1.5">
                        <Input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="삭제 사유 (3자 이상)"
                          className="text-xs"
                        />
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            loading={busyId === m.id}
                            onClick={() => void handleDelete(m.id)}
                          >
                            삭제 확정
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setConfirmId(null);
                              setReason('');
                            }}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setConfirmId(m.id);
                          setReason('');
                        }}
                      >
                        삭제
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore ? (
            <div className="py-3 text-center">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={loading}
                onClick={() => void fetchPage(rows.length, PAGE_SIZE, true)}
              >
                더 보기
              </Button>
            </div>
          ) : (
            <p className="py-3 text-center text-[11px] text-cdm-fg-muted">
              이번 시즌 전적을 모두 불러왔습니다. ({rows.length}건)
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-cdm-fg-muted">
        삭제 시 당사자 두 명의 RP·티어·연승/연패·시즌 승패가 남은 기록 기준으로 자동 역산됩니다.
        (season_peak_tier 는 과거 최고 기록이라 변경되지 않습니다.)
      </p>
    </div>
  );
}
