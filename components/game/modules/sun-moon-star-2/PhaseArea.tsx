'use client';

import { useRef } from 'react';
import PowderInput from './PowderInput';
import BetInput from './BetInput';
import MarkRevealPanel from './MarkRevealPanel';
import WaitingCard, { buildWaitingText } from './WaitingCard';
import FinalResult from './FinalResult';
import PowderStageDeltaBanner from './PowderStageDeltaBanner';
import type { SMS2ResolveStep } from '@/shared/types/sun-moon-star-2';
import type { SMS2ContextValue } from './hooks/useSMS2Context';

/* ════════════════════════════════════════════════════════════
 * PhaseArea — 페이즈에 따라 입력/대기/정산/종료 카드 중 하나를 렌더
 *   우선순위: 종료 > 정산/라운드결과 > 베팅입력 > 빛가루입력 > 대기
 *   모바일/데스크탑 공유 (가로폭은 부모가 결정)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: SMS2ContextValue;
  /** 모바일에서 BetInput을 bottom-sheet로 분리할 때 true — 내 베팅 차례여도 BetInput 대신 WaitingCard 표시 */
  hideBetInput?: boolean;
}

export default function PhaseArea({ ctx, hideBetInput = false }: Props) {
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
    isPowder,
    isBet,
    isBetFirst,
    isBetSecond,
    isResolve,
    isRoundEnd,
    isFinished,
    pendingPowder,
    pendingBet,
    submitting,
    setPendingPowder,
    setPendingBet,
    resetPowder,
    resetBet,
    handleSubmitPowder,
    handleCancelPowder,
    handleSubmitBet,
    mySubmittedPowder,
    myTurnInBet,
  } = ctx;

  /*
   * resolve → roundEnd 전환 시 resolveSteps가 null이 돼도 패널이 유지되도록 캐싱.
   * 같은 참조를 넘기면 MarkRevealPanel의 cachedRef 체크가 통과 → 애니 재시작 없이 done 상태 유지.
   * powder 페이즈(새 라운드)가 오면 새 steps가 들어오며 자연스럽게 덮어쓰기됨.
   */
  const resolveStepsCache = useRef<SMS2ResolveStep[] | null>(null);
  if (gameData?.resolveSteps) {
    resolveStepsCache.current = gameData.resolveSteps;
  }

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  if (isFinished) {
    return (
      <FinalResult
        finalWinner={gameData.finalWinner}
        winType={gameData.winType}
        players={gameData.players}
        myId={myId}
      />
    );
  }

  if (isResolve || isRoundEnd) {
    return (
      <MarkRevealPanel
        resolveSteps={resolveStepsCache.current}
        players={gameData.players}
        mySide={mySide}
      />
    );
  }

  if (!isSpectator && myPlayer && isBet && myTurnInBet) {
    const lastRecord = gameData.history.at(-1) ?? null;
    if (hideBetInput) {
      /* 모바일: BetInput은 bottom-sheet로 분리 → 여기선 배너+대기만 */
      return (
        <div className="flex flex-col gap-2">
          <PowderStageDeltaBanner
            players={gameData.players}
            lastRecord={lastRecord}
            mySide={mySide}
          />
          <WaitingCard
            text={buildWaitingText({
              phase,
              isSpectator,
              firstPlayer,
              secondPlayer,
              mySubmittedPowder,
            })}
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <PowderStageDeltaBanner
          players={gameData.players}
          lastRecord={lastRecord}
          mySide={mySide}
        />
        <BetInput
          turn={isBetFirst ? 'first' : 'second'}
          myChips={myPlayer.chips}
          opponentChips={opponent?.chips ?? 0}
          value={pendingBet}
          firstBet={isBetSecond ? opponent?.publicBet ?? null : null}
          firstSide={firstSide}
          submitting={submitting}
          disabled={myPlayer.betConfirmed || submitting}
          onChange={setPendingBet}
          onSubmit={handleSubmitBet}
          onReset={resetBet}
        />
      </div>
    );
  }

  if (!isSpectator && myPlayer && isBet && !myTurnInBet) {
    const lastRecord = gameData.history.at(-1) ?? null;
    return (
      <div className="flex flex-col gap-2">
        <PowderStageDeltaBanner
          players={gameData.players}
          lastRecord={lastRecord}
          mySide={mySide}
        />
        <WaitingCard
          text={buildWaitingText({
            phase,
            isSpectator,
            firstPlayer,
            secondPlayer,
            mySubmittedPowder,
          })}
        />
      </div>
    );
  }

  if (!isSpectator && myPlayer && isPowder) {
    return (
      <PowderInput
        powderRemain={gameData.selfPrivate?.powderRemain ?? 0}
        value={pendingPowder}
        submitted={mySubmittedPowder}
        opponentSubmitted={opponent?.submittedPowder ?? false}
        submitting={submitting}
        onChange={setPendingPowder}
        onSubmit={handleSubmitPowder}
        onCancel={handleCancelPowder}
        onReset={resetPowder}
      />
    );
  }

  /* 그 외: 대기 */
  const showWaiting =
    (isPowder && mySubmittedPowder) ||
    (isSpectator && (isPowder || isBet));

  if (!showWaiting) return null;

  const lastRecord = gameData.history.at(-1) ?? null;

  /* 빛가루 제출 후 상대 대기 중 — 다음 라운드 꺼진 칸 미리 표시 */
  if (isPowder && mySubmittedPowder) {
    return (
      <div className="flex flex-col gap-2">
        <PowderStageDeltaBanner
          players={gameData.players}
          lastRecord={lastRecord}
          mySide={mySide}
        />
        <WaitingCard
          text={buildWaitingText({
            phase,
            isSpectator,
            firstPlayer,
            secondPlayer,
            mySubmittedPowder,
          })}
        />
      </div>
    );
  }

  if (isSpectator && isBet) {
    return (
      <div className="flex flex-col gap-2">
        <PowderStageDeltaBanner
          players={gameData.players}
          lastRecord={lastRecord}
          mySide={mySide}
        />
        <WaitingCard
          text={buildWaitingText({
            phase,
            isSpectator,
            firstPlayer,
            secondPlayer,
            mySubmittedPowder,
          })}
        />
      </div>
    );
  }

  return (
    <WaitingCard
      text={buildWaitingText({
        phase,
        isSpectator,
        firstPlayer,
        secondPlayer,
        mySubmittedPowder,
      })}
    />
  );
}
