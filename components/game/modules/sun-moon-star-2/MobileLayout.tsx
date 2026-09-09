'use client';

import { useEffect, useRef } from 'react';
import MarkRow from './MarkRow';
import FirstBetRevealBanner from './FirstBetRevealBanner';
import PhaseArea from './PhaseArea';
import BetInput from './BetInput';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import { GameFrame } from '@/components/game/GameFrame';

/* ════════════════════════════════════════════════════════════
 * MobileLayout — 모바일 1컬럼 입력 우선 레이아웃 (≤ 1023px)
 *   · sticky 헤더 + 컴팩트 stepper 만 항상 보이게
 *   · 입력 카드(PhaseArea)는 반드시 첫 화면 안쪽에 위치
 *   · 부가 정보(풀 PowderTrack, 상대 추리, 라운드 기록)는 details 접힘
 *   · 가로 스크롤 절대 발생 금지: overflow-x-hidden + min-w-0
 *   · 자동 스크롤 ref/effect 는 이 컴포넌트 안에서만 정의
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: SMS2ContextValue;
}

export default function MobileLayout({ ctx }: Props) {
  const {
    gameData,
    isSpectator,
    myPlayer,
    opponent,
    firstSide,
    firstPlayer,
    secondPlayer,
    isResolve,
    isRoundEnd,
    isBetFirst,
    isBetSecond,
    mySubmittedPowder,
    myBetConfirmed,
    myTurnInBet,
    isMyInputTurn,
    revealedBetFirst,
    markRowPendingPowder,
    litMark,
    pendingBet,
    setPendingBet,
    resetBet,
    handleSubmitBet,
    submitting,
  } = ctx;

  /* ── 베팅 bottom-sheet 표시 여부 ── */
  const showBetSheet = !isSpectator && myPlayer && (isBetFirst || isBetSecond) && myTurnInBet && !myPlayer.betConfirmed;

  /* ── 모바일 자동 스크롤: 내 차례 진입 시 입력 영역으로 ── */
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMyInputTurn || !gameData) return;
    const key = `${gameData.round}-${gameData.phase}-${mySubmittedPowder}-${myBetConfirmed}`;
    if (lastScrolledKeyRef.current === key) return;
    lastScrolledKeyRef.current = key;
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const target = inputAreaRef.current;
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  }, [isMyInputTurn, gameData, mySubmittedPowder, myBetConfirmed]);

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  return (
    <>
      <GameFrame
        /* 이 게임은 입력판이 커서 뼈대 여백까지 아껴야 한 화면에 들어간다. */
        className="gap-1.5 p-1.5"
      >
        <div className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden">
        <div className="w-full min-w-0">
          <MarkRow
            size="sm"
            myContribution={gameData.selfPrivate?.myMarkContribution ?? null}
            pendingPowder={markRowPendingPowder}
            litMark={litMark}
            dimUnlit={isResolve || isRoundEnd}
          />
        </div>

        {isBetSecond && revealedBetFirst && (
          <FirstBetRevealBanner
            firstBet={revealedBetFirst}
            firstSide={firstSide}
            firstNick={firstPlayer.nickname}
            isMyTurn={!isSpectator && myTurnInBet}
          />
        )}

        {/* 입력 / 대기 / 정산 / 종료 — 자동 스크롤 타깃 */}
        <div ref={inputAreaRef} className="w-full min-w-0">
          <PhaseArea ctx={ctx} hideBetInput />
        </div>
        </div>
      </GameFrame>

      {/* ── 베팅 bottom-sheet ── */}
      {showBetSheet && myPlayer && (
        <>
          {/* dim overlay */}
          <div className="fixed inset-0 z-(--cdm-z-overlay) bg-black/30" />
          {/* sheet */}
          <div
            className="fixed inset-x-0 bottom-0 z-(--cdm-z-modal) rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl"
            style={{ animation: 'sms2SlideUp 250ms ease-out forwards' }}
          >
            <div className="mx-auto mb-3 mt-2 h-1 w-10 rounded-full bg-gray-300" />
            <div className="overflow-y-auto px-4 pb-safe-bottom pb-6" style={{ maxHeight: '70dvh' }}>
              <BetInput
                turn={isBetFirst ? 'first' : 'second'}
                myChips={myPlayer.chips}
                opponentChips={opponent?.chips ?? 0}
                value={pendingBet}
                firstBet={isBetSecond ? opponent?.publicBet ?? null : null}
                firstSide={firstSide!}
                submitting={submitting}
                disabled={myPlayer.betConfirmed || submitting}
                onChange={setPendingBet}
                onSubmit={handleSubmitBet}
                onReset={resetBet}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
