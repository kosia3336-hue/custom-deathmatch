'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import type { GuildV4UnseenPayout } from '@/lib/guild-v4/types';

function rankClass(rank: number): string {
  if (rank === 1) return 'text-cdm-highlight-strong';
  if (rank === 2) return 'text-cdm-fg';
  return 'text-cdm-fg-muted';
}

function PayoutBody({ p }: { p: GuildV4UnseenPayout }) {
  const kindLabel = p.kind === 'weekly' ? '주간 길드 랭킹' : '월간 길드 랭킹';
  const rewards: string[] = [];
  if (p.gp > 0) rewards.push(`길드 포인트 ${p.gp.toLocaleString('ko-KR')} GP`);
  if (p.tickets > 0) rewards.push(`뽑기권 ${p.tickets}장`);
  if (p.titleGranted) rewards.push(`길드 칭호 「${p.guildName}」`);

  return (
    <div className="flex flex-col gap-5 py-1">
      <div className="flex flex-col gap-1.5 text-center">
        <p className="text-xs font-semibold tracking-widest text-cdm-primary">{kindLabel}</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-cdm-fg-muted">{p.periodLabel}</p>
      </div>

      <div className="rounded-cdm-md bg-cdm-bg-elev-1 px-4 py-4 text-center">
        <p className="text-xs text-cdm-fg-muted">우리 길드 순위</p>
        <p className={`mt-2 text-4xl font-bold tabular-nums leading-none ${rankClass(p.rank)}`}>
          {p.rank}위
        </p>
        <p className="mt-3 text-sm font-medium leading-relaxed text-cdm-fg">{p.guildName}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-cdm-fg-muted">받은 보상</p>
        {rewards.length === 0 ? (
          <p className="text-sm leading-relaxed text-cdm-fg">없음</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rewards.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-cdm-fg">
                {line}
              </li>
            ))}
          </ul>
        )}
        {p.gp > 0 ? (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-cdm-fg-subtle">
            {'길드 포인트는\n길드 통장에 들어갔습니다.'}
          </p>
        ) : null}
        {p.tickets > 0 ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-cdm-fg-subtle">
            {'뽑기권은 정산 당시\n길드원 전원에게 지급되었습니다.'}
          </p>
        ) : null}
        {p.titleGranted ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-cdm-fg-subtle">
            {'월간 1위 길드원에게\n길드 이름과 같은 칭호가 지급되었습니다.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 로그인 접속 시 안 본 주간·월간 정산을 하나씩 띄운다.
 */
export function GuildRankPayoutModal() {
  const [queue, setQueue] = useState<GuildV4UnseenPayout[]>([]);
  const [busy, setBusy] = useState(false);
  const current = queue[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/guild2/payouts');
        if (!res.ok) return;
        const json = (await res.json()) as { payouts?: GuildV4UnseenPayout[] };
        if (!cancelled && json.payouts?.length) setQueue(json.payouts);
      } catch {
        /* 접속 모달은 실패해도 화면을 막지 않는다 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await fetch('/api/guild2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ack_rank_payout',
          periodKind: current.kind,
          periodKey: current.periodKey,
        }),
      });
    } catch {
      /* ack 실패해도 이번 세션에서는 닫는다 */
    } finally {
      setBusy(false);
      setQueue((prev) => prev.slice(1));
    }
  }

  if (!current) return null;

  return (
    <Modal
      open
      title={current.kind === 'weekly' ? '주간 랭킹 정산' : '월간 랭킹 정산'}
      size="sm"
      closeOnBackdrop={false}
      closeOnEscape={false}
      mobileBottomSheet={false}
      footer={
        <Button onClick={() => void dismiss()} loading={busy} className="w-full">
          확인
        </Button>
      }
    >
      <PayoutBody p={current} />
    </Modal>
  );
}
