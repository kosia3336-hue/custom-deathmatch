'use client';

import type { BankContextValue } from './hooks/useBankContext';
import InventoryRow from './InventoryRow';
import FirstCountRevealBanner from './FirstCountRevealBanner';
import PhaseStepperDesktop from './PhaseStepperDesktop';
import PhaseArea from './PhaseArea';

/* ════════════════════════════════════════════════════════════
 * DesktopLayout — ≥ 1024px
 *   sun-moon-star-2 와 동일 패턴:
 *     메인 (flex-1, items-center, overflow-y-auto, p-5)
 *       └── w-full max-w-2xl 자식들 → 가운데 정렬
 *     우측 사이드바 (w-72, border-l, p-4)
 *       └── ScorePanel + OpponentBox + RoundHistoryTable
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: BankContextValue;
}

export default function DesktopLayout({ ctx }: Props) {
  const {
    gameData,
    isSpectator,
    myPlayer,
    mySide,
    firstSide,
    firstPlayer,
    secondPlayer,
    phase,
    isFirstReveal,
    isSecondSubmit,
    myTurnInput,
    stepperActiveTurn,
    pendingBet,
  } = ctx;

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const myIsFirst = mySide === firstSide;
  const firstBetCount = firstPlayer.publicBetCount;
  const showBanner = (isFirstReveal || isSecondSubmit) && firstBetCount != null;

  return (
    <div className="bank-layout bank-layout-desktop flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ── 메인 영역 (가운데 정렬) ── */}
        <div className="bank-main flex flex-1 flex-col items-center gap-3 overflow-y-auto p-5">
          {/* 페이즈 스테퍼 */}
          <div className="w-full max-w-2xl">
            <PhaseStepperDesktop
              phase={phase ?? 'firstSubmit'}
              isMyTurn={stepperActiveTurn}
              isSpectator={isSpectator}
              firstNick={firstPlayer.nickname}
              secondNick={secondPlayer.nickname}
              myIsFirst={myIsFirst}
            />
          </div>

          {/* 본인 인벤토리 — 관전자 숨김 */}
          {!isSpectator && myPlayer?.inventory && myPlayer.inventoryAmount != null && (
            <div className="w-full max-w-2xl">
              <InventoryRow
                inventory={myPlayer.inventory}
                inventoryAmount={myPlayer.inventoryAmount}
                pendingBet={myTurnInput ? pendingBet : null}
                size="md"
              />
            </div>
          )}

          {/* 선 장수 공개 배너 */}
          {showBanner && firstBetCount != null && (
            <div className="w-full max-w-2xl">
              <FirstCountRevealBanner
                firstNick={firstPlayer.nickname}
                firstBetCount={firstBetCount}
                isMyTurn={!isSpectator && !myIsFirst && isSecondSubmit}
              />
            </div>
          )}

          {/* 메인 페이즈 영역 */}
          <div className="w-full max-w-2xl">
            <PhaseArea ctx={ctx} size="md" />
          </div>

        </div>
      </div>
    </div>
  );
}
