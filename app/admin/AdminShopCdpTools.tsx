'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { formatCdp, formatCdpDelta } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';

interface MemberCdpRow {
  memberId: string;
  nickname: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export default function AdminShopCdpTools() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<MemberCdpRow[]>([]);
  const [adjustTarget, setAdjustTarget] = useState<MemberCdpRow | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) {
      toast.error('닉네임 2자 이상 입력해주세요.');
      return;
    }
    setSearching(true);
    try {
      const res = await fetch('/api/admin/cdp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = (await res.json()) as { rows?: MemberCdpRow[]; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? '검색 실패');
        setRows([]);
        return;
      }
      setRows(json.rows ?? []);
      if ((json.rows ?? []).length === 0) toast('일치하는 회원이 없습니다.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-base font-semibold text-cdm-fg">회원 CDP 조정</h2>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임 2자 이상"
          />
          <Button size="md" type="submit" loading={searching}>
            검색
          </Button>
        </form>

        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-cdm-border text-xs text-cdm-fg-muted">
                <tr>
                  <th className="py-2 text-left">닉네임</th>
                  <th className="py-2 text-right">잔액</th>
                  <th className="py-2 text-right">누적 획득</th>
                  <th className="py-2 text-right">누적 소비</th>
                  <th className="py-2 text-right">조정</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.memberId} className="border-b border-cdm-border/50">
                    <td className="py-2 font-semibold text-cdm-fg">{r.nickname}</td>
                    <td className="py-2 text-right font-bold tabular-nums">
                      {formatCdp(r.balance)}
                    </td>
                    <td className="py-2 text-right text-cdm-fg-muted tabular-nums">
                      {formatCdp(r.totalEarned)}
                    </td>
                    <td className="py-2 text-right text-cdm-fg-muted tabular-nums">
                      {formatCdp(r.totalSpent)}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setAdjustTarget(r)}>
                        조정
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adjustTarget && (
        <AdjustModal
          target={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onApplied={(newBalance) => {
            setRows((prev) =>
              prev.map((r) =>
                r.memberId === adjustTarget.memberId ? { ...r, balance: newBalance } : r,
              ),
            );
            setAdjustTarget(null);
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({
  target,
  onClose,
  onApplied,
}: {
  target: MemberCdpRow;
  onClose: () => void;
  onApplied: (newBalance: number) => void;
}) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleApply() {
    const d = Number(delta);
    if (!Number.isInteger(d) || d === 0 || Math.abs(d) > 100_000) {
      toast.error('변경량은 0 이 아닌 정수, |delta| ≤ 100,000');
      return;
    }
    if (reason.trim().length < 3 || reason.length > 200) {
      toast.error('사유는 3~200 자');
      return;
    }
    if (!confirm(`${target.nickname} 의 CDP 를 ${formatCdpDelta(d)} 조정할까요?`)) return;

    setBusy(true);
    try {
      const res = await fetch('/api/admin/cdp/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: target.memberId, delta: d, reason: reason.trim() }),
      });
      const json = (await res.json()) as {
        ok?: true;
        newBalance?: number;
        appliedDelta?: number;
        clamped?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? '조정 실패');
        return;
      }
      const applied = Number(json.appliedDelta ?? 0);
      const balance = Number(json.newBalance ?? 0);
      if (json.clamped) {
        toast(
          `잔액이 음수가 될 수 없어 자동 보정. 적용 ${formatCdpDelta(applied)}, 새 잔액 ${formatCdp(balance)}`,
          { duration: 6000 },
        );
      } else {
        toast.success(
          `${formatCdpDelta(applied)} CDP 조정 완료. 새 잔액 ${formatCdp(balance)}`,
        );
      }
      onApplied(balance);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="CDP 조정"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={handleApply} loading={busy}>
            적용
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div className="rounded-cdm-md bg-cdm-bg-elev-1 p-3">
          <p className="font-semibold text-cdm-fg">{target.nickname}</p>
          <p className="inline-flex items-center gap-1 text-cdm-fg-muted tabular-nums">
            잔액 <CdpIcon size={14} /> {formatCdp(target.balance)}
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">변경량 (±정수)</label>
          <TextInput
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="예: -100  또는  +500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">사유 (3~200자)</label>
          <textarea
            className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="환불 보정, 이벤트 보상 등"
          />
        </div>
        <p className="text-[11px] text-cdm-fg-subtle">
          ※ 음수 결과 잔액은 0 으로 자동 클램프되며, 감사 로그에 모두 기록됩니다.
        </p>
      </div>
    </Modal>
  );
}
