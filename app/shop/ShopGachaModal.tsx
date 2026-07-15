'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { formatCdp } from '@/lib/cdp/format';
import { GACHA_PRICE_CDP } from '@/lib/gacha/constants';
import { fetchGachaPool, useGachaDraw } from '@/lib/gacha/useGachaDraw';
import { useInventoryStore } from '@/stores/inventory';
import type { GachaPoolResponse } from '@/lib/gacha/types';
import GachaOddsPanel from './GachaOddsPanel';
import GachaDrawCeremony from './GachaDrawCeremony';
import GachaReveal from './GachaReveal';

interface Props {
  open: boolean;
  onClose: () => void;
  balance: number;
  onBalanceChange: (n: number) => void;
}

export default function ShopGachaModal({
  open,
  onClose,
  balance,
  onBalanceChange,
}: Props) {
  const [pool, setPool] = useState<GachaPoolResponse | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const { phase, result, busy, draw, resetToIdle, finishReveal } = useGachaDraw();
  const ticketCount = useInventoryStore((s) => s.items?.gacha_ticket ?? 0);

  const price = pool?.priceCdp ?? GACHA_PRICE_CDP;
  const canClose = phase === 'idle' && !busy;

  const refreshPool = useCallback(async () => {
    setLoadingPool(true);
    try {
      const p = await fetchGachaPool();
      setPool(p);
      onBalanceChange(p.balance);
    } catch {
      toast.error('확률표를 불러오지 못했어요.');
    } finally {
      setLoadingPool(false);
    }
  }, [onBalanceChange]);

  useEffect(() => {
    if (!open) return;
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    void refreshPool();
    resetToIdle();
  }, [open, refreshPool, resetToIdle]);

  async function handleDraw(useTicket = false) {
    if (busy) return;
    if (!useTicket && balance < price) return;
    if (useTicket && ticketCount < 1) return;
    try {
      const ok = await draw(reducedMotion, useTicket);
      if (ok) onBalanceChange(ok.newBalance);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'insufficient_balance') {
        toast.error('CDP가 부족해요.');
      } else if (code === 'insufficient_ticket') {
        toast.error('뽑기권이 없어요.');
      } else {
        toast.error((e as Error).message || '뽑기에 실패했어요.');
      }
    }
  }

  function handleClose() {
    if (!canClose) return;
    finishReveal();
    onClose();
  }

  function handleConfirmReveal() {
    finishReveal();
    void refreshPool();
    onClose();
  }

  function handleDrawAgain() {
    finishReveal();
    void refreshPool();
    void handleDraw();
  }

  const title =
    phase === 'drawing' ? '뽑는 중…'
    : phase === 'reveal' ? '결과'
    : 'CDP 뽑기';

  return (
    <Modal
      open={open}
      onClose={canClose ? handleClose : undefined}
      title={title}
      size="lg"
      className="sm:max-w-xl"
      closeOnBackdrop={canClose}
      closeOnEscape={canClose}
      mobileBottomSheet
    >
      {phase === 'idle' && (
        <>
          {loadingPool && !pool ? (
            <p className="py-8 text-center text-sm text-cdm-fg-muted">불러오는 중…</p>
          ) : pool ? (
            <GachaOddsPanel pool={pool} />
          ) : (
            <p className="py-8 text-center text-sm text-cdm-fg-muted">뽑기 정보를 불러올 수 없어요.</p>
          )}

          <div className="sticky bottom-0 -mx-5 mt-4 border-t border-cdm-border bg-cdm-bg/95 px-5 py-4 backdrop-blur">
            <div className="mb-2 flex justify-between text-xs text-cdm-fg-muted">
              <span>보유 {formatCdp(balance)}</span>
              <span>차감 후 {formatCdp(Math.max(0, balance - price))}</span>
            </div>
            <Button
              fullWidth
              size="md"
              disabled={balance < price || busy || loadingPool}
              onClick={() => void handleDraw(false)}
            >
              {balance < price
                ? `뽑기 (${formatCdp(price - balance)} 부족)`
                : `${formatCdp(price)} CDP로 뽑기`}
            </Button>
            {ticketCount > 0 && (
              <Button
                fullWidth
                size="md"
                variant="secondary"
                className="mt-2"
                disabled={busy || loadingPool}
                onClick={() => void handleDraw(true)}
              >
                뽑기권으로 뽑기 (보유 {ticketCount}장)
              </Button>
            )}
          </div>
        </>
      )}

      {phase === 'drawing' && <GachaDrawCeremony reducedMotion={reducedMotion} />}

      {phase === 'reveal' && result && (
        <GachaReveal
          result={result}
          reducedMotion={reducedMotion}
          onConfirm={handleConfirmReveal}
          onDrawAgain={handleDrawAgain}
        />
      )}
    </Modal>
  );
}
