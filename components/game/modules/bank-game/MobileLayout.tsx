'use client';

import { useEffect, useRef, useState } from 'react';
import type { BankContextValue } from './hooks/useBankContext';
import MobileHeader from './MobileHeader';
import PhaseStepperMobile from './PhaseStepperMobile';
import ScoreBar from './ScoreBar';
import InventoryRow from './InventoryRow';
import FirstCountRevealBanner from './FirstCountRevealBanner';
import OpponentInventoryTracker from './OpponentInventoryTracker';
import RoundHistoryTable from './RoundHistoryTable';
import PhaseArea from './PhaseArea';
import BetInput from './BetInput';
import { GameFrame } from '@/components/game/GameFrame';
import Modal from '@/components/ui/Modal';

/* ════════════════════════════════════════════════════════════
 * MobileLayout — 모바일 1컬럼 입력 우선 레이아웃 (≤ 1023px)
 *   · BetInput 은 bottom-sheet 모달 (열기/닫기 토글 + 바깥 터치로 닫기)
 *   · 보조 정보(라운드 기록, 상대 추리)는 details 접힘
 *   · 가로 스크롤 절대 발생 금지: overflow-x-hidden + min-w-0
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: BankContextValue;
}

export default function MobileLayout({ ctx }: Props) {
  const {
    gameData,
    isSpectator,
    myId,
    myPlayer,
    opponent,
    mySide,
    firstSide,
    firstPlayer,
    secondPlayer,
    phase,
    isFirstReveal,
    isFirstSubmit,
    isSecondSubmit,
    isFinished,
    myTurnInput,
    isMyInputTurn,
    stepperActiveTurn,
    pendingBet,
    setPendingBet,
    submitting,
    handleSubmitBet,
    handleResetBet,
    isReveal,
    showOpponentTracker,
  } = ctx;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);

  /* 내 차례가 되면 자동으로 시트 열기 */
  useEffect(() => {
    if (!gameData || isSpectator) return;
    const tid = setTimeout(() => setSheetOpen(!!myTurnInput), 0);
    return () => clearTimeout(tid);
  }, [gameData, myTurnInput, isSpectator]);

  /* bottom-sheet가 활성화돼야 하는 조건 */
  const canShowSheet =
    !isSpectator &&
    !!myPlayer &&
    (isFirstSubmit || isSecondSubmit) &&
    !!myTurnInput &&
    !myPlayer.betConfirmed;

  const showSheet = canShowSheet && sheetOpen;

  /* ── 자동 스크롤: 본인 입력턴/정산 진입 시 PhaseArea 로 ── */
  const phaseAreaRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameData) return;
    const shouldScroll = isMyInputTurn || isReveal;
    if (!shouldScroll) return;
    const key = `${gameData.round}-${gameData.phase}`;
    if (lastScrolledKeyRef.current === key) return;
    lastScrolledKeyRef.current = key;
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const target = phaseAreaRef.current;
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  }, [gameData, isMyInputTurn, isReveal]);

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const myIsFirst = mySide === firstSide;
  const firstBetCount = firstPlayer.publicBetCount;
  const showBanner = (isFirstReveal || isSecondSubmit) && firstBetCount != null;

  return (
    <>
      <GameFrame
        className="bank-layout bank-layout-mobile"
        info={
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <MobileHeader
              round={gameData.round}
              maxRound={gameData.maxRound}
              phase={phase ?? 'firstSubmit'}
              firstNick={firstPlayer.nickname}
              loserAmountTotal={gameData.loserAmountTotal}
            />
            <PhaseStepperMobile
              phase={phase ?? 'firstSubmit'}
              isMyTurn={stepperActiveTurn}
              isSpectator={isSpectator}
              firstNick={firstPlayer.nickname}
              secondNick={secondPlayer.nickname}
              myIsFirst={myIsFirst}
            />
            <ScoreBar
              p1={gameData.players.p1}
              p2={gameData.players.p2}
              firstSide={firstSide}
              myId={myId}
            />
          </div>
        }
        controls={
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            {!isSpectator && myPlayer?.inventory && myPlayer.inventoryAmount != null && (
              <InventoryRow
                inventory={myPlayer.inventory}
                inventoryAmount={myPlayer.inventoryAmount}
                pendingBet={myTurnInput ? pendingBet : null}
                size="sm"
              />
            )}
            <div className="flex gap-1.5">
              {!isSpectator && canShowSheet && !showSheet && (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="bank-primary-action flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white shadow-lg"
                >
                  베팅 입력하기 →
                </button>
              )}
              {gameData.history.length > 0 && !isFinished && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-600"
                >
                  라운드 기록 ({gameData.history.length})
                </button>
              )}
              {showOpponentTracker && (
                <button
                  type="button"
                  onClick={() => setTrackerOpen(true)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-600"
                >
                  상대 잔여 추리
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="bank-mobile-content flex h-full w-full min-w-0 flex-col items-center justify-center gap-2 overflow-hidden">
          {showBanner && firstBetCount != null && (
            <FirstCountRevealBanner
              firstNick={firstPlayer.nickname}
              firstBetCount={firstBetCount}
              isMyTurn={!isSpectator && !myIsFirst && isSecondSubmit}
            />
          )}
          <PhaseArea ctx={ctx} ref={phaseAreaRef} size="sm" hideBetInput={canShowSheet} />
        </div>
      </GameFrame>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="라운드 기록">
        <RoundHistoryTable
          history={gameData.history}
          mySide={mySide}
          players={gameData.players}
          variant="mobile"
        />
      </Modal>

      <Modal open={trackerOpen} onClose={() => setTrackerOpen(false)} title="상대 잔여 추리">
        <OpponentInventoryTracker />
      </Modal>

      {/* ── 베팅 bottom-sheet ── */}
      {!isSpectator && canShowSheet && (
        <>
          {/* dim overlay — 터치로 닫기 */}
          <div
            className={`bank-sheet-overlay fixed inset-0 z-(--cdm-z-overlay) bg-black/40 transition-opacity duration-300 lg:hidden ${
              showSheet ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={() => setSheetOpen(false)}
          />

          {/* sheet */}
          <div
            className={`bank-bet-sheet fixed inset-x-0 bottom-0 z-(--cdm-z-modal) flex max-h-[80dvh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
              showSheet ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="flex shrink-0 justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>
            {myPlayer?.inventory && myPlayer.inventoryAmount != null && (
              <div
                className="overflow-y-auto px-4 py-2"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
              >
                <BetInput
                  turn={isFirstSubmit ? 'first' : 'second'}
                  inventory={myPlayer.inventory}
                  inventoryAmount={myPlayer.inventoryAmount}
                  inventoryCount={myPlayer.inventoryCount}
                  value={pendingBet}
                  submitting={submitting}
                  disabled={false}
                  onChange={setPendingBet}
                  onSubmit={handleSubmitBet}
                  onReset={handleResetBet}
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* 재열기 단추는 조작 칸에 있다. 화면에 띄우면 방 바닥글을 가린다. */}
        </>
      )}
    </>
  );
}
