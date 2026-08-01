'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';

interface Props {
  boxOpen: boolean;
  held: number;
  deposited: number;
}

/** 이벤트 쿠폰함 — 보유/투입 현황 + 투입 액션 */
export default function EventCouponClient({ boxOpen, held, deposited }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  async function deposit() {
    if (busy || count < 1) return;
    setBusy(true);
    try {
      const res = await fetch('/api/event/coupons/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = (await res.json()) as { deposited?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? '쿠폰 투입에 실패했습니다.');
        return;
      }
      toast.success(`이벤트 쿠폰 ${data.deposited}장을 쿠폰함에 넣었습니다!`);
      setCount(1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg p-4 text-center">
          <p className="text-xs text-cdm-fg-muted">보유 쿠폰</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-cdm-fg">{held}장</p>
        </div>
        <div className="rounded-cdm-lg border border-cdm-primary bg-cdm-primary-soft/40 p-4 text-center">
          <p className="text-xs text-cdm-fg-muted">쿠폰함에 넣은 쿠폰</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-cdm-primary">{deposited}장</p>
        </div>
      </div>

      {boxOpen ? (
        held > 0 ? (
          <div className="flex flex-col gap-2 rounded-cdm-lg border border-cdm-border bg-cdm-bg p-4">
            <p className="text-sm font-semibold text-cdm-fg">쿠폰함에 넣기</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={held}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(held, Math.floor(Number(e.target.value) || 1))))
                }
                className="w-24 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-center text-sm font-bold tabular-nums text-cdm-fg"
              />
              <Button variant="secondary" size="sm" onClick={() => setCount(held)}>
                전부 ({held}장)
              </Button>
              <Button onClick={deposit} disabled={busy || count < 1}>
                {busy ? '넣는 중…' : `${count}장 넣기`}
              </Button>
            </div>
            <p className="text-[11px] text-cdm-fg-subtle">
              한 번 넣은 쿠폰은 돌려받을 수 없습니다. 많이 넣을수록 당첨 확률이 올라가요!
            </p>
          </div>
        ) : (
          <p className="rounded-cdm-lg border border-dashed border-cdm-border p-4 text-center text-sm text-cdm-fg-muted">
            보유한 쿠폰이 없습니다. 랭크게임에서 승리하면 닉네임이 적힌 이벤트 쿠폰을 1장씩 받습니다.
          </p>
        )
      ) : (
        <p className="rounded-cdm-lg border border-dashed border-cdm-border p-4 text-center text-sm text-cdm-fg-muted">
          쿠폰함이 닫혔어요. 이벤트가 종료되어 더 이상 쿠폰을 넣을 수 없습니다.
        </p>
      )}
    </div>
  );
}
