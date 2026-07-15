'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import Button from '@/components/ui/Button';
import { useEventChipsStore } from '@/stores/eventChips';
import { useCdpStore } from '@/stores/cdp';
import { formatCdp } from '@/lib/cdp/format';

/**
 * 이벤트 칩 → CDP 환전 위젯.
 * - 1칩 = 5 CDP, 10% 수수료
 * - 최소 10칩
 */
export default function ShopEventChipExchange() {
  const balance = useEventChipsStore((s) => s.balance);
  const setEventChipBalance = useEventChipsStore((s) => s.setBalance);
  const setCdpBalance = useCdpStore((s) => s.setBalance);
  const [chipsInput, setChipsInput] = useState<string>('10');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 마운트 시 잔액 동기화
    fetch('/api/me/event-chips', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { balance?: number } | null) => {
        if (typeof j?.balance === 'number') setEventChipBalance(j.balance);
      })
      .catch(() => {});
  }, [setEventChipBalance]);

  const current = balance ?? 0;
  const parsedChips = Math.trunc(Number(chipsInput) || 0);
  const gross = parsedChips * 5;
  const fee = Math.floor(gross * 0.1);
  const net = gross - fee;

  const handleExchange = async () => {
    if (parsedChips < 10) {
      toast.error('최소 10칩 이상 입력해주세요.');
      return;
    }
    if (parsedChips > current) {
      toast.error(`보유 칩(${current}개)보다 많이 환전할 수 없습니다.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/me/event-chips/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chips: parsedChips }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error ?? '환전에 실패했습니다.');
        return;
      }
      setEventChipBalance(Number(j.newChipBalance ?? 0));
      setCdpBalance(Number(j.newCdpBalance ?? 0));
      setChipsInput('10');
      toast.success(
        `-${j.chipsExchanged}칩 → +${formatCdp(Number(j.returnedCdp ?? 0))} CDP (수수료 ${formatCdp(Number(j.feeCdp ?? 0))})`,
      );
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="default" className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-cdm-fg sm:text-lg">이벤트 칩 환전</h3>
          <p className="text-xs text-cdm-fg-muted">
            1칩 = 5 CDP · 10% 수수료 · 최소 10칩부터
          </p>
        </div>
        <div className="text-sm tabular-nums text-cdm-fg-muted">
          보유 칩 <strong className="text-cdm-fg">{current}</strong>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 flex flex-col gap-1 text-xs text-cdm-fg-muted">
          환전할 칩 수
          <input
            type="number"
            min={1}
            step={1}
            value={chipsInput}
            disabled={submitting}
            onChange={(e) => setChipsInput(e.target.value)}
            className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm tabular-nums"
          />
        </label>
        <div className="flex flex-col gap-0.5 rounded-cdm-md bg-cdm-bg-elev-1 px-3 py-2 text-xs sm:flex-1">
          <div className="flex justify-between">
            <span className="text-cdm-fg-muted">환전 후 CDP</span>
            <span className="tabular-nums font-bold text-cdm-fg">+{formatCdp(net)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cdm-fg-muted">수수료 (10%)</span>
            <span className="tabular-nums text-cdm-accent">-{formatCdp(fee)}</span>
          </div>
        </div>
        <Button
          variant="primary"
          disabled={submitting}
          loading={submitting}
          onClick={handleExchange}
          className="sm:w-32"
        >
          환전
        </Button>
      </div>
      {current < 10 && (
        <p className="text-xs text-cdm-fg-muted">최소 10칩 보유 시 환전할 수 있습니다.</p>
      )}
    </Card>
  );
}
