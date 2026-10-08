'use client';

import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import { useEffect, useState } from 'react';
import { BankReference } from './BankReference';
import BetInput from './BetInput';
import FirstCountRevealBanner from './FirstCountRevealBanner';
import type { BankContextValue } from './hooks/useBankContext';
import PhaseArea from './PhaseArea';

/** PC와 모바일 공통 배치. 모바일 베팅은 접는 시트, 기록/메모는 하단 탭 또는 PC 독립 창. */

interface Props {
  ctx: BankContextValue;
}

export default function GameLayout({ ctx }: Props) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const {
    gameData,
    isSpectator,
    myPlayer,
    mySide,
    firstSide,
    firstPlayer,
    secondPlayer,
    isFirstReveal,
    isFirstSubmit,
    isSecondSubmit,
    myTurnInput,
    pendingBet,
    setPendingBet,
    submitting,
    isRoundEnd,
    handleNextRoundReady,
    handleSubmitBet,
    handleResetBet,
  } = ctx;

  const [sheetOpen, setSheetOpen] = useState(false);

  /* 내 차례가 되면 자동으로 시트 열기 */
  useEffect(() => {
    if (isSpectator) return;
    const tid = setTimeout(() => setSheetOpen(!!myTurnInput), 0);
    return () => clearTimeout(tid);
  }, [gameData?.round, gameData?.phase, myTurnInput, isSpectator]);

  /* bottom-sheet가 활성화돼야 하는 조건 */
  const canShowSheet =
    !isSpectator &&
    !!myPlayer &&
    (isFirstSubmit || isSecondSubmit) &&
    !!myTurnInput &&
    !myPlayer.betConfirmed;

  const showSheet = canShowSheet && sheetOpen;
  const showNextRoundButton = isRoundEnd && !isSpectator;
  const showInputButton = !desktop && !isSpectator && canShowSheet && !showSheet;

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const myIsFirst = mySide === firstSide;
  const firstBetCount = firstPlayer.publicBetCount;
  const showBanner = (isFirstReveal || isSecondSubmit) && firstBetCount != null;

  return (
    <>
      <GameReferenceFrame
        reference={<BankReference ctx={ctx} />}
        className="bank-layout bank-layout-mobile"
        controls={
          showNextRoundButton || showInputButton ? (
            <div className="flex w-full min-w-0 flex-col gap-1.5">
              {/*
              라운드 종료 버튼. 예전에는 무대(PhaseArea) 안에 있었는데, 무대는
              contain:size 라 넘치면 스크롤 없이 그냥 잘린다 — 정산 내용이 길면
              이 버튼이 화면 밖으로 사라져 다음 라운드로 못 갔다.
              누르는 것은 전부 controls 로 (GameFrame 주석의 세 칸 문법).
            */}
              {showNextRoundButton && (
                <button
                  type="button"
                  onClick={handleNextRoundReady}
                  className="bank-primary-action w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
                >
                  다음 라운드로 →
                </button>
              )}
              <div className="flex gap-1.5">
                {showInputButton && (
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="bank-primary-action flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white shadow-lg"
                  >
                    베팅 입력하기 →
                  </button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        <div
          data-game-intrinsic-stage
          className="bank-mobile-content flex w-full max-w-2xl min-w-0 flex-col items-center justify-center gap-2 p-3"
        >
          {showBanner && firstBetCount != null && (
            <FirstCountRevealBanner
              firstNick={firstPlayer.nickname}
              firstBetCount={firstBetCount}
              isMyTurn={!isSpectator && !myIsFirst && isSecondSubmit}
            />
          )}
          <PhaseArea
            ctx={ctx}
            size={desktop ? 'md' : 'sm'}
            hideBetInput={canShowSheet && !desktop}
            hideNextRound
          />
        </div>
      </GameReferenceFrame>

      <Modal
        open={ctx.zeroBetConfirmationOpen}
        onClose={ctx.handleCancelZeroBet}
        title="0원 제출 확인"
        size="sm"
        mobileBottomSheet={false}
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="secondary" onClick={ctx.handleCancelZeroBet} autoFocus>
              취소
            </Button>
            <Button onClick={ctx.handleConfirmZeroBet} disabled={submitting}>
              0원 제출
            </Button>
          </>
        }
      >
        <p className="text-cdm-fg text-sm">정말 0원 제출합니까?</p>
      </Modal>

      {/* ── 베팅 bottom-sheet ── */}
      {!desktop && !isSpectator && canShowSheet && (
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
                style={{ paddingBottom: 'max(16px, var(--cdm-safe-bottom, 0px))' }}
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
