'use client';

import { useEffect, useRef, useState } from 'react';
import type { BankContextValue } from './hooks/useBankContext';
import PhaseStepperMobile from './PhaseStepperMobile';
import InventoryRow from './InventoryRow';
import FirstCountRevealBanner from './FirstCountRevealBanner';
import PhaseArea from './PhaseArea';
import BetInput from './BetInput';
import { GameFrame } from '@/components/game/GameFrame';

/* ════════════════════════════════════════════════════════════
 * MobileLayout — 모바일 1컬럼 입력 우선 레이아웃 (≤ 1023px)
 *   · BetInput 은 bottom-sheet 모달 (열기/닫기 토글 + 바깥 터치로 닫기)
 *   · 보조 정보(라운드 기록, 상대 추리)는 상단 바 '메모' 시트로 (index.tsx 의 setHud)
 *   · 가로 스크롤 절대 발생 금지: overflow-x-hidden + min-w-0
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: BankContextValue;
}

export default function MobileLayout({ ctx }: Props) {
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
    isFirstSubmit,
    isSecondSubmit,
    myTurnInput,
    isMyInputTurn,
    stepperActiveTurn,
    pendingBet,
    setPendingBet,
    submitting,
    isRoundEnd,
    handleNextRoundReady,
    handleSubmitBet,
    handleResetBet,
    isReveal,
  } = ctx;

  const [sheetOpen, setSheetOpen] = useState(false);

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
        controls={
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            {/*
              라운드 세부 진행 — 선 제출 · 선공개 · 후제출 · 정산.
              상단 바에는 '몇 라운드인가'(1 / 9R)만 두고, '그 라운드 안 어디쯤인가'
              는 손 가까운 아래에 둔다. 다음에 무엇을 할지 알려 주는 표시라
              누르는 자리 옆에 있는 편이 읽힌다.
            */}
            <PhaseStepperMobile
              phase={phase ?? 'firstSubmit'}
              isMyTurn={stepperActiveTurn}
              isSpectator={isSpectator}
              firstNick={firstPlayer.nickname}
              secondNick={secondPlayer.nickname}
              myIsFirst={myIsFirst}
            />
            {/*
              라운드 종료 버튼. 예전에는 무대(PhaseArea) 안에 있었는데, 무대는
              contain:size 라 넘치면 스크롤 없이 그냥 잘린다 — 정산 내용이 길면
              이 버튼이 화면 밖으로 사라져 다음 라운드로 못 갔다.
              누르는 것은 전부 controls 로 (GameFrame 주석의 세 칸 문법).
            */}
            {isRoundEnd && !isSpectator && (
              <button
                type="button"
                onClick={handleNextRoundReady}
                className="bank-primary-action w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
              >
                다음 라운드로 →
              </button>
            )}
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
          <PhaseArea ctx={ctx} ref={phaseAreaRef} size="sm" hideBetInput={canShowSheet} hideNextRound />
        </div>
      </GameFrame>


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
