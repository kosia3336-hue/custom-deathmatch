'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { CONSUMABLE_LABELS, type ConsumableKind } from '@/lib/cdp/types';

interface MemberInvRow {
  memberId: string;
  nickname: string;
  inventory: Record<ConsumableKind, number>;
}

const KINDS: ConsumableKind[] = [
  'nickname_change',
  'rank_reset',
  'spectator_lock',
  'anonymity',
  'magnifier',
  'ban_eraser',
  'counter_charm',
  'calm_charm',
  'demotion_shield',
];

export default function AdminShopConsumablesTools() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<MemberInvRow[]>([]);
  const [target, setTarget] = useState<{ row: MemberInvRow; kind: ConsumableKind } | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) {
      toast.error('닉네임 2자 이상 입력해주세요.');
      return;
    }
    setSearching(true);
    try {
      const res = await fetch('/api/admin/consumables/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = (await res.json()) as { rows?: MemberInvRow[]; error?: string };
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

  function applyLocal(memberId: string, kind: ConsumableKind, countAfter: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.memberId === memberId
          ? { ...r, inventory: { ...r.inventory, [kind]: countAfter } }
          : r,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-base font-semibold text-cdm-fg">소모성 인벤토리 조정</h2>
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
                  {KINDS.map((k) => (
                    <th key={k} className="py-2 text-right">{CONSUMABLE_LABELS[k]}</th>
                  ))}
                  <th className="py-2 text-right">조정</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.memberId} className="border-b border-cdm-border/50 align-middle">
                    <td className="py-2 font-semibold text-cdm-fg">{r.nickname}</td>
                    {KINDS.map((k) => (
                      <td key={k} className="py-2 text-right tabular-nums">
                        {r.inventory[k] ?? 0}
                      </td>
                    ))}
                    <td className="py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {KINDS.map((k) => (
                          <Button
                            key={k}
                            size="sm"
                            variant="secondary"
                            onClick={() => setTarget({ row: r, kind: k })}
                          >
                            {CONSUMABLE_LABELS[k].slice(0, 3)}…
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {target && (
        <AdjustModal
          target={target.row}
          kind={target.kind}
          onClose={() => setTarget(null)}
          onApplied={(countAfter) => {
            applyLocal(target.row.memberId, target.kind, countAfter);
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({
  target,
  kind,
  onClose,
  onApplied,
}: {
  target: MemberInvRow;
  kind: ConsumableKind;
  onClose: () => void;
  onApplied: (countAfter: number) => void;
}) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleApply() {
    const d = Number(delta);
    if (!Number.isInteger(d) || d === 0 || Math.abs(d) > 1000) {
      toast.error('변경량은 0 이 아닌 정수, |delta| ≤ 1,000');
      return;
    }
    if (reason.trim().length < 3 || reason.length > 200) {
      toast.error('사유는 3~200자');
      return;
    }
    if (!confirm(`${target.nickname} 의 ${CONSUMABLE_LABELS[kind]} 을 ${d > 0 ? '+' : ''}${d}개 조정할까요?`))
      return;

    setBusy(true);
    try {
      const res = await fetch('/api/admin/consumables/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: target.memberId,
          kind,
          delta: d,
          reason: reason.trim(),
        }),
      });
      const json = (await res.json()) as {
        ok?: true;
        countAfter?: number;
        appliedDelta?: number;
        clamped?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? '조정 실패');
        return;
      }
      const countAfter = Number(json.countAfter ?? 0);
      const applied = Number(json.appliedDelta ?? 0);
      if (json.clamped) {
        toast(
          `잔량이 음수가 될 수 없어 자동 보정. 적용 ${applied}, 잔량 ${countAfter}`,
          { duration: 6000 },
        );
      } else {
        toast.success(`${applied} 조정 완료. 잔량 ${countAfter}`);
      }
      onApplied(countAfter);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={`${CONSUMABLE_LABELS[kind]} 조정`}
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
          <p className="text-cdm-fg-muted tabular-nums">
            현재 보유: {target.inventory[kind] ?? 0}개
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">변경량 (±정수, ±1000 이내)</label>
          <TextInput
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="예: -1  또는  +5"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">사유 (3~200자)</label>
          <textarea
            className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="환불, 보상, 버그 보정 등"
          />
        </div>
        <p className="text-[11px] text-cdm-fg-subtle">
          ※ 음수 결과 잔량은 0 으로 자동 클램프되며, 감사 로그에 모두 기록됩니다.
        </p>
      </div>
    </Modal>
  );
}
