'use client';

import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import { BankReference } from './BankReference';
import FirstCountRevealBanner from './FirstCountRevealBanner';
import type { BankContextValue } from './hooks/useBankContext';
import PhaseArea from './PhaseArea';
import styles from './layout.module.css';

/** 베팅 입력은 게임판에 펼치고, 모바일 메모만 접힌 모달로 표시한다. */

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
  } = ctx;

  const showNextRoundButton = isRoundEnd && !isSpectator;

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
          <PhaseArea ctx={ctx} size={desktop ? 'md' : 'sm'} hideNextRound />
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
    </>
  );
}
