'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCdpStore } from '@/stores/cdp';
import { getSocket } from '@/lib/socket';
import { formatCdp, formatCdpDelta } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  /** layout 등 SSR 위치에서 사용할 수 있게 외부에서 잔액을 주입할 수 있다 */
  initialBalance?: number;
  className?: string;
  variant?: 'desktop' | 'mobile';
}

/**
 * GNB 우측에 항상 노출되는 CDP 잔액 칩.
 * - 마운트 시 /api/me/cdp 로 1회 동기화 (initialBalance 가 있으면 fetch 생략)
 * - 'cdp:granted' / 'cdp:adjusted' 소켓 이벤트로 실시간 갱신
 * - 클릭 시 /shop 으로 이동
 * - 거상(first_merchant) 칭호 활성 시 마크 표시
 */
export function CdpBalanceChip({ initialBalance, className, variant = 'desktop' }: Props) {
  const balance = useCdpStore((s) => s.balance);
  const setBalance = useCdpStore((s) => s.setBalance);
  const [merchantDiscount, setMerchantDiscount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (initialBalance != null) {
      setBalance(initialBalance);
    }
    // merchantDiscount 는 initialBalance 와 무관하게 매번 fetch (간단하지만 가벼움)
    fetch('/api/me/cdp', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { balance?: number; merchantDiscount?: boolean } | null) => {
        if (cancelled || !j) return;
        if (initialBalance == null && typeof j.balance === 'number') {
          setBalance(j.balance);
        }
        setMerchantDiscount(j.merchantDiscount === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialBalance, setBalance]);

  useEffect(() => {
    const socket = getSocket();
    const onGranted = (p: { newBalance: number; amount: number; reason?: string }) => {
      if (typeof p.newBalance !== 'number') return;
      setBalance(p.newBalance);
      if (typeof p.amount === 'number' && p.amount > 0) {
        const isDaily = p.reason === 'daily_rank_win';
        toast.success(
          isDaily
            ? `오늘 첫 랭크 승리! ${formatCdpDelta(p.amount)} CDP`
            : `${formatCdpDelta(p.amount)} CDP`,
          { description: `잔액 ${formatCdp(p.newBalance)}` },
        );
      }
    };
    const onAdjusted = (p: { newBalance: number; delta: number; reason: string }) => {
      if (typeof p.newBalance !== 'number') return;
      setBalance(p.newBalance);
      if (p.reason === 'admin_adjust' && typeof p.delta === 'number') {
        toast(`관리자 조정 ${formatCdpDelta(p.delta)} CDP`, {
          description: `잔액 ${formatCdp(p.newBalance)}`,
        });
      }
    };
    socket.on('cdp:granted', onGranted);
    socket.on('cdp:adjusted', onAdjusted);
    return () => {
      socket.off('cdp:granted', onGranted);
      socket.off('cdp:adjusted', onAdjusted);
    };
  }, [setBalance]);

  // 거상 칭호 구매 시 ShopClient 가 발행하는 custom event 로 즉시 ON.
  useEffect(() => {
    function onMerchantChange(e: Event) {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      if (typeof detail?.active === 'boolean') {
        setMerchantDiscount(detail.active);
      }
    }
    window.addEventListener('cdm:merchant-discount', onMerchantChange);
    return () => window.removeEventListener('cdm:merchant-discount', onMerchantChange);
  }, []);

  const display = balance ?? initialBalance ?? 0;

  if (variant === 'mobile') {
    return (
      <Link
        href="/shop"
        className={cn(
          'flex items-center justify-between px-4 py-2.5 text-sm text-cdm-fg hover:bg-cdm-bg-elev-1',
          className,
        )}
        role="menuitem"
      >
        <span className="flex items-center gap-1.5">
          보유 CDP
        </span>
        <span className="inline-flex items-center gap-1 font-bold tabular-nums">
          <CdpIcon size={16} />
          {formatCdp(display)}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/shop"
      title={merchantDiscount ? '거상 효과 활성 — 상점 10% 할인' : '보유 CDP — 상점으로 이동'}
      className={cn(
        'inline-flex items-center gap-1 rounded-cdm-md px-2.5 py-1.5 text-xs font-bold tabular-nums',
        merchantDiscount
          ? 'bg-white/10 text-cdm-ink-fg ring-1 ring-cdm-highlight/50 hover:bg-white/15'
          : 'bg-white/10 text-cdm-ink-fg hover:bg-white/15',
        'transition-colors',
        className,
      )}
    >
      <CdpIcon size={14} />
      <span>{formatCdp(display)}</span>
    </Link>
  );
}
