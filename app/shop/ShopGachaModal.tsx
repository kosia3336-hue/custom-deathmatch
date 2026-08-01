'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { formatCdp } from '@/lib/cdp/format';
import { GACHA_MAX_BULK_COUNT, GACHA_PRICE_CDP } from '@/lib/gacha/constants';
import { fetchGachaPool, useGachaDraw } from '@/lib/gacha/useGachaDraw';
import { useInventoryStore } from '@/stores/inventory';
import type { GachaPayMode, GachaPoolResponse } from '@/lib/gacha/types';
import GachaOddsPanel from './GachaOddsPanel';
import GachaDrawCeremony from './GachaDrawCeremony';
import GachaReveal from './GachaReveal';
import GachaBulkResult from './GachaBulkResult';

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
  const [count, setCount] = useState(1);

  const { phase, result, busy, draw, drawMany, resetToIdle, finishReveal } = useGachaDraw();
  const ticketCount = useInventoryStore((s) => s.items?.gacha_ticket ?? 0);

  const price = pool?.priceCdp ?? GACHA_PRICE_CDP;
  // 결과 화면에서도 닫기/이어뽑기가 가능해야 하므로 drawing 중에만 잠근다.
  const canClose = phase !== 'drawing' && !busy;

  // count 회를 뽑을 때: 보유 뽑기권으로 먼저 채우고, 나머지를 CDP 로 낸다.
  const ticketPart = Math.min(ticketCount, count);
  const cdpPart = count - ticketPart;
  const cdpCost = cdpPart * price;
  const affordable = ticketCount + Math.floor(balance / price);
  const canDraw = affordable >= 1;

  const refreshPool = useCallback(async () => {
    setLoadingPool(true);
    try {
      const p = await fetchGachaPool();
      setPool(p);
      onBalanceChange(p.balance);
    } catch {
      toast.error('확률표를 불러오지 못했습니다.');
    } finally {
      setLoadingPool(false);
    }
  }, [onBalanceChange]);

  useEffect(() => {
    if (!open) return;
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setCount(1);
    void refreshPool();
    resetToIdle();
  }, [open, refreshPool, resetToIdle]);

  const runDraw = useCallback(
    async (n: number, payMode: GachaPayMode = 'auto') => {
      if (busy) return;
      try {
        const ok = n > 1
          ? await drawMany(reducedMotion, n, payMode)
          : await draw(reducedMotion, payMode);
        if (ok) {
          onBalanceChange(ok.newBalance);
          if (ok.stoppedError) toast.error(ok.stoppedError);
        }
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'insufficient_balance') {
          toast.error('CDP가 부족합니다.');
        } else if (code === 'insufficient_ticket') {
          toast.error('뽑기권이 없습니다.');
        } else {
          toast.error((e as Error).message || '뽑기에 실패했습니다.');
        }
      } finally {
        // 잔액·확률표를 갱신해 두어야 이어 뽑기에서 정확한 상태로 판단한다.
        void refreshPool();
      }
    },
    [busy, draw, drawMany, onBalanceChange, reducedMotion, refreshPool],
  );

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

  // 결과 화면에서 바로 이어 뽑기 — 모달을 닫지 않고 같은 조건으로 재실행한다.
  function handleDrawAgain() {
    void runDraw(Math.max(1, Math.min(count, affordable)), 'auto');
  }

  const drawAgainLabel =
    ticketPart > 0
      ? `다시 뽑기 (뽑기권 ${ticketPart}장${cdpPart > 0 ? ` + ${formatCdp(cdpCost)}` : ''})`
      : `다시 뽑기 (${formatCdp(cdpCost)})`;

  const title =
    phase === 'drawing' ? '뽑는 중…'
    : phase === 'reveal' || phase === 'bulk' ? '결과'
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
            <p className="py-8 text-center text-sm text-cdm-fg-muted">뽑기 정보를 불러올 수 없습니다.</p>
          )}

          <div className="sticky bottom-0 -mx-5 mt-4 border-t border-cdm-border bg-cdm-bg/95 px-5 py-4 backdrop-blur">
            {/* 수량 선택 */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-cdm-fg-muted">수량</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={count <= 1 || busy}
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  aria-label="수량 감소"
                >
                  −
                </Button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={GACHA_MAX_BULK_COUNT}
                  value={count}
                  disabled={busy}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    setCount(Number.isFinite(n) && n > 0 ? Math.min(GACHA_MAX_BULK_COUNT, n) : 1);
                  }}
                  className="w-16 rounded-md border border-cdm-border bg-cdm-bg px-2 py-1 text-center text-sm tabular-nums text-cdm-fg"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={count >= GACHA_MAX_BULK_COUNT || busy}
                  onClick={() => setCount((c) => Math.min(GACHA_MAX_BULK_COUNT, c + 1))}
                  aria-label="수량 증가"
                >
                  +
                </Button>
              </div>
              <div className="ml-auto flex gap-1">
                {[1, 10, GACHA_MAX_BULK_COUNT].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setCount(n)}
                  >
                    {n}회
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-2 flex justify-between text-xs text-cdm-fg-muted">
              <span>
                보유 {formatCdp(balance)}
                {ticketCount > 0 && ` · 뽑기권 ${ticketCount}장`}
              </span>
              <span>차감 후 {formatCdp(Math.max(0, balance - cdpCost))}</span>
            </div>

            <Button
              fullWidth
              size="md"
              disabled={!canDraw || busy || loadingPool}
              onClick={() => void runDraw(count, 'auto')}
            >
              {!canDraw
                ? `뽑기 (${formatCdp(price - balance)} 부족)`
                : ticketPart > 0
                  ? `${count}회 뽑기 — 뽑기권 ${ticketPart}장${cdpPart > 0 ? ` + ${formatCdp(cdpCost)}` : ''}`
                  : `${count}회 뽑기 — ${formatCdp(cdpCost)}`}
            </Button>

            {ticketCount > 0 && (
              <Button
                fullWidth
                size="md"
                variant="secondary"
                className="mt-2"
                disabled={busy || loadingPool || balance < count * price}
                onClick={() => void runDraw(count, 'cdp')}
              >
                뽑기권 아끼고 CDP로만 뽑기 ({formatCdp(count * price)})
              </Button>
            )}

            {affordable < count && (
              <p className="mt-2 text-center text-xs text-cdm-fg-muted">
                현재 잔액·뽑기권으로는 최대 {affordable}회까지 뽑을 수 있습니다.
              </p>
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
          drawAgainLabel={drawAgainLabel}
          drawAgainDisabled={busy || !canDraw}
        />
      )}

      {phase === 'bulk' && result && (
        <GachaBulkResult
          response={result}
          onConfirm={handleConfirmReveal}
          onDrawAgain={handleDrawAgain}
          drawAgainLabel={drawAgainLabel}
          drawAgainDisabled={busy || !canDraw}
        />
      )}
    </Modal>
  );
}
