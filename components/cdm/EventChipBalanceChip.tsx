'use client';

import { useEffect } from 'react';
import { useEventChipsStore } from '@/stores/eventChips';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CHIP_ICON = '🪙';

function formatChips(n: number): string {
  return Intl.NumberFormat('ko-KR').format(n);
}

interface Props {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * GNB 우측 이벤트 칩 잔액 칩.
 * - 마운트 시 /api/me/event-chips 로 1회 동기화
 * - event:chip:changed 소켓 이벤트로 실시간 갱신
 */
export function EventChipBalanceChip({ className, variant = 'desktop' }: Props) {
  const balance = useEventChipsStore((s) => s.balance);
  const setBalance = useEventChipsStore((s) => s.setBalance);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/event-chips', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { balance?: number } | null) => {
        if (cancelled || !j) return;
        if (typeof j.balance === 'number') setBalance(j.balance);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setBalance]);

  useEffect(() => {
    const socket = getSocket();
    const onChange = (p: { newBalance: number; delta: number; reason: string }) => {
      if (typeof p.newBalance !== 'number') return;
      setBalance(p.newBalance);
      if (typeof p.delta === 'number' && p.delta !== 0) {
        if (p.reason === 'event_hand') {
          if (p.delta > 0) {
            toast.success(`${CHIP_ICON} +${formatChips(p.delta)} 칩`, {
              description: `잔액 ${formatChips(p.newBalance)}`,
            });
          } else {
            toast(`${CHIP_ICON} ${formatChips(p.delta)} 칩`, {
              description: `잔액 ${formatChips(p.newBalance)}`,
            });
          }
        }
      }
    };
    socket.on('event:chip:changed', onChange);
    return () => {
      socket.off('event:chip:changed', onChange);
    };
  }, [setBalance]);

  const display = balance ?? 0;

  if (variant === 'mobile') {
    return (
      <a
        href="/event"
        className={cn(
          'flex items-center justify-between px-4 py-2.5 text-sm text-cdm-fg hover:bg-cdm-bg-elev-1',
          className,
        )}
        role="menuitem"
      >
        <span>이벤트 칩</span>
        <span className="font-bold tabular-nums">
          <span aria-hidden>{CHIP_ICON}</span> {formatChips(display)}
        </span>
      </a>
    );
  }

  return (
    <a
      href="/event"
      title="이벤트 칩 — 인디언홀덤(이벤트) 입장"
      className={cn(
        'inline-flex items-center gap-1 rounded-cdm-md px-2.5 py-1.5 text-xs font-bold tabular-nums',
        'bg-cdm-highlight/10 text-cdm-fg ring-1 ring-cdm-highlight/40 hover:bg-cdm-highlight/15',
        'transition-colors',
        className,
      )}
    >
      <span aria-hidden>{CHIP_ICON}</span>
      <span>{formatChips(display)}</span>
    </a>
  );
}
