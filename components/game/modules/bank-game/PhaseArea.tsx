'use client';

import { forwardRef } from 'react';
import type { BankContextValue } from './hooks/useBankContext';
import BetInput from './BetInput';
import WaitingCard from './WaitingCard';
import ResolvePanel from './ResolvePanel';
import FinalResult from './FinalResult';

/* ════════════════════════════════════════════════════════════
 * PhaseArea — 페이즈에 따라 입력/대기/정산/종료 카드를 선택
 *   · 모바일/데스크탑 공유. size prop 으로 BetInput 크기만 조정.
 *   · ref 는 본인 입력턴 진입 시 모바일 자동 스크롤 타깃.
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: BankContextValue;
  size?: 'sm' | 'md';
  /** 모바일 bottom-sheet 모드일 때 BetInput 인라인 렌더링 생략 */
  hideBetInput?: boolean;
}

const PhaseArea = forwardRef<HTMLDivElement, Props>(function PhaseArea(
  { ctx, size = 'sm', hideBetInput = false },
  ref,
) {
  const {
    gameData,
    isFinished,
    isReveal,
    isRoundEnd,
    isFirstReveal,
    isFirstSubmit,
    isSecondSubmit,
    myTurnInput,
    myPlayer,
    isSpectator,
    pendingBet,
    setPendingBet,
    submitting,
    handleSubmitBet,
    handleResetBet,
    handleNextRoundReady,
    mySide,
    isMyInventoryEmpty,
  } = ctx;

  if (!gameData) return null;

  /* 종료 */
  if (isFinished) {
    return (
      <div ref={ref}>
        <FinalResult
          finalWinner={gameData.finalWinner}
          winType={gameData.winType}
          players={gameData.players}
          myId={ctx.myId}
        />
      </div>
    );
  }

  /* 정산 */
  if (isReveal || isRoundEnd) {
    return (
      <div ref={ref} className="flex flex-col gap-2">
        <ResolvePanel gameData={gameData} mySide={mySide} instant={isRoundEnd} />
        {isRoundEnd && !isSpectator && (
          <button
            type="button"
            onClick={handleNextRoundReady}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            다음 라운드로 →
          </button>
        )}
      </div>
    );
  }

  /* 입력 페이즈 */
  if (isFirstSubmit || isSecondSubmit) {
    /* 관전자 */
    if (isSpectator) {
      const firstNick = gameData.players[gameData.firstSide].nickname;
      const secondSide = gameData.firstSide === 'p1' ? 'p2' : 'p1';
      const secondNick = gameData.players[secondSide].nickname;
      return (
        <div ref={ref}>
          <WaitingCard
            text={
              isFirstSubmit
                ? `${firstNick} (선) 베팅 중...`
                : `${secondNick} (후) 베팅 중...`
            }
          />
        </div>
      );
    }

    /* 본인 입력 차례 */
    if (myTurnInput && myPlayer?.inventory && myPlayer.inventoryAmount != null) {
      // 인벤토리가 비었으면 자동 0장 안내
      if (isMyInventoryEmpty) {
        return (
          <div ref={ref}>
            <WaitingCard
              text="인벤토리가 비었습니다"
              subtext="자동 0장 베팅으로 진행됩니다..."
            />
          </div>
        );
      }
      // 모바일 bottom-sheet 모드: 여기서 BetInput 렌더링 생략
      if (hideBetInput) {
        return <div ref={ref} />;
      }
      return (
        <div ref={ref}>
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
            size={size}
          />
        </div>
      );
    }

    /* 본인이 이미 제출했거나 상대 차례 */
    if (myPlayer?.betConfirmed) {
      return (
        <div ref={ref}>
          <WaitingCard
            text="✓ 베팅 확정"
            subtext={
              isFirstSubmit
                ? '상대(후)가 후 베팅 페이즈를 기다리는 중...'
                : '정산 결과를 기다리는 중...'
            }
          />
        </div>
      );
    }

    return (
      <div ref={ref}>
        <WaitingCard
          text={
            isFirstSubmit ? '선의 베팅 대기 중...' : '후의 베팅 대기 중...'
          }
        />
      </div>
    );
  }

  /* firstReveal 페이즈 (선이 제출, 후가 추리/베팅 시작 직전) */
  if (isFirstReveal) {
    return (
      <div ref={ref}>
        <WaitingCard
          text="후의 추리·베팅 입력 대기 중..."
          subtext="선의 장수가 공개되었습니다"
        />
      </div>
    );
  }

  return null;
});

export default PhaseArea;
