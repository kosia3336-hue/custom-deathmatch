'use client';

import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useState } from 'react';
import BetInput from './BetInput';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import { BankReference } from './BankReference';
import FirstCountRevealBanner from './FirstCountRevealBanner';
import type { BankContextValue } from './hooks/useBankContext';
import PhaseArea from './PhaseArea';
import styles from './layout.module.css';

/** PC 는 베팅 판을 게임판에 펼치고, 모바일은 해달별2처럼 시트로 띄운다. */

interface Props {
  ctx: BankContextValue;
}

export default function GameLayout({ ctx }: Props) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const {
    gameData,
    isSpectator,
    mySide,
    firstSide,
    firstPlayer,
    secondPlayer,
    isFirstReveal,
    isSecondSubmit,
    submitting,
    isRoundEnd,
    handleNextRoundReady,
    myPlayer,
    myTurnInput,
    isMyInventoryEmpty,
    isFirstSubmit,
  } = ctx;

  const showNextRoundButton = isRoundEnd && !isSpectator;

  /*
    모바일 베팅은 해달별2처럼 시트로 띄운다.

    판 안에 베팅 판을 펼쳐 두면 점수판 · '선 제출 완료' 안내 아래로 밀려, 작은 폰
    (375×667)에서는 '베팅 확정' 버튼이 화면 밖으로 나갔다(게임 칸 안 135px 넘침).
    내 차례가 되면 시트가 올라오고, 접으면 판이 보이며, 조작 칸의 버튼으로 다시 연다.
    라운드·단계가 바뀌면 다시 펼친 상태로 돌아간다.
  */
  const betTurn =
    myTurnInput && !!myPlayer?.inventory && myPlayer.inventoryAmount != null && !isMyInventoryEmpty;
  const sheetKey = `${gameData?.round}-${gameData?.phase}`;
  const [sheet, setSheet] = useState({ key: sheetKey, open: true });
  if (sheet.key !== sheetKey) setSheet({ key: sheetKey, open: true });
  const sheetOpen = sheet.key === sheetKey && sheet.open;
  const setSheetOpen = (open: boolean) => setSheet({ key: sheetKey, open });
  const showSheet = !desktop && betTurn && sheetOpen;

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const myIsFirst = mySide === firstSide;
  const firstBetCount = firstPlayer.publicBetCount;
  const showBanner = (isFirstReveal || isSecondSubmit) && firstBetCount != null;

  return (
    <>
      <GameReferenceFrame
        reference={<BankReference ctx={ctx} />}
        className={`bank-layout bank-layout-mobile ${styles.frame}`}
        controls={
          showNextRoundButton ? (
            <button
              type="button"
              onClick={handleNextRoundReady}
              className="bank-primary-action w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
            >
              다음 라운드로 →
            </button>
          ) : !desktop && betTurn ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={`bank-primary-action w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] ${
                isFirstSubmit
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isFirstSubmit ? '선 베팅하기 →' : '후 베팅하기 →'}
            </button>
          ) : undefined
        }
      >
        <div
          data-game-intrinsic-stage
          className="bank-mobile-content flex w-full max-w-2xl min-w-0 flex-col items-center justify-center gap-2 px-3 py-1"
        >
          {showBanner && firstBetCount != null && (
            <FirstCountRevealBanner
              firstNick={firstPlayer.nickname}
              firstBetCount={firstBetCount}
              isMyTurn={!isSpectator && !myIsFirst && isSecondSubmit}
            />
          )}
          <PhaseArea ctx={ctx} size={desktop ? 'md' : 'sm'} hideNextRound hideBetInput={!desktop} />
        </div>
      </GameReferenceFrame>

      {/* ── 모바일 베팅 시트 ── */}
      {showSheet && myPlayer?.inventory && myPlayer.inventoryAmount != null && (
        <>
          {/* 바깥을 누르면 접어서 판을 본다 */}
          <div
            className="fixed inset-0 z-(--cdm-z-overlay) bg-black/30"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="bank-bet-sheet fixed inset-x-0 bottom-0 z-(--cdm-z-modal) rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl"
            style={{ animation: 'bankSheetUp 250ms ease-out forwards' }}
          >
            <style>{`@keyframes bankSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="입력판 접고 판 보기"
              className="flex w-full flex-col items-center gap-1 pt-2 pb-1"
            >
              <span className="h-1 w-10 rounded-full bg-gray-300" />
              <span className="text-[11px] font-semibold text-gray-400">눌러서 접고 판 보기</span>
            </button>
            <div
              className="flex justify-center overflow-y-auto px-4"
              style={{
                maxHeight: '70dvh',
                paddingBottom: 'calc(1.5rem + var(--cdm-safe-bottom, 0px))',
              }}
            >
              <BetInput
                turn={isFirstSubmit ? 'first' : 'second'}
                inventory={myPlayer.inventory}
                inventoryAmount={myPlayer.inventoryAmount}
                inventoryCount={myPlayer.inventoryCount}
                value={ctx.pendingBet}
                submitting={submitting}
                disabled={false}
                onChange={ctx.setPendingBet}
                onSubmit={ctx.handleSubmitBet}
                onReset={ctx.handleResetBet}
                size="sm"
              />
            </div>
          </div>
        </>
      )}

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
    </>
  );
}
