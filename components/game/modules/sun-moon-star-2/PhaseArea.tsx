'use client';

import { resolveStepsForDisplay } from '@/lib/sunMoonStarDisplay';
import BetInput from './BetInput';
import FinalResult from './FinalResult';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import MarkRevealPanel from './MarkRevealPanel';
import PowderStageDeltaBanner from './PowderStageDeltaBanner';
import DalmajiBetPanel from './skins/DalmajiBetPanel';
import WaitingCard, { buildWaitingText } from './WaitingCard';

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
    pendingBet,
    submitting,
    setPendingBet,
    resetBet,
    handleSubmitBet,
    mySubmittedPowder,
    myTurnInBet,
  } = ctx;

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
        resolveSteps={resolveStepsForDisplay(gameData)}
        round={gameData.round}
        players={gameData.players}
        mySide={mySide}
        dalmaji={ctx.dalmaji}
        complete={isRoundEnd}
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
        {ctx.dalmaji ? (
          <DalmajiBetPanel
            turn={isBetFirst ? 'first' : 'second'}
            myChips={myPlayer.chips}
            opponentChips={opponent?.chips ?? 0}
            value={pendingBet}
            firstBet={isBetSecond ? (opponent?.publicBet ?? null) : null}
            submitting={submitting}
            disabled={myPlayer.betConfirmed || submitting}
            onChange={setPendingBet}
            onSubmit={handleSubmitBet}
            onReset={resetBet}
          />
        ) : (
          <BetInput
            turn={isBetFirst ? 'first' : 'second'}
            myChips={myPlayer.chips}
            opponentChips={opponent?.chips ?? 0}
            value={pendingBet}
            firstBet={isBetSecond ? (opponent?.publicBet ?? null) : null}
            firstSide={firstSide}
            submitting={submitting}
            disabled={myPlayer.betConfirmed || submitting}
            onChange={setPendingBet}
            onSubmit={handleSubmitBet}
            onReset={resetBet}
          />
        )}
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

  /* 그 외: 대기 */
  const showWaiting = (isPowder && mySubmittedPowder) || (isSpectator && (isPowder || isBet));

  if (!showWaiting) return null;

  const lastRecord = gameData.history.at(-1) ?? null;

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
