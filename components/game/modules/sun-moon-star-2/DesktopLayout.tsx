'use client';

import MarkRow from './MarkRow';
import DalmajiMarkRow from './skins/DalmajiMarkRow';
import FirstBetRevealBanner from './FirstBetRevealBanner';
import PhaseStepperDesktop from './PhaseStepperDesktop';
import PhaseArea from './PhaseArea';
import type { SMS2ContextValue } from './hooks/useSMS2Context';

/* ════════════════════════════════════════════════════════════
 * DesktopLayout — ≥ 1024px
 *   다른 게임들과 동일 패턴:
 *     메인 (flex-1, items-center, overflow-y-auto, p-5)
 *       └── w-full max-w-2xl 자식들 → 가운데 정렬
 *     우측 사이드바 (w-72, border-l, p-4)
 *       └── ScorePanel + PowderTrack(compact) + RoundHistoryTable
 * ════════════════════════════════════════════════════════════ */

interface Props {
  ctx: SMS2ContextValue;
}

export default function DesktopLayout({ ctx }: Props) {
  const {
    gameData,
    isSpectator,
    mySide,
    firstSide,
    firstPlayer,
    secondPlayer,
    phase,
    isResolve,
    isRoundEnd,
    isBetSecond,
    myTurnInBet,
    stepperActiveTurn,
    revealedBetFirst,
    markRowPendingPowder,
    litMark,
    dalmaji,
  } = ctx;

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const Marks = dalmaji ? DalmajiMarkRow : MarkRow;

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">

        {/* ── 메인 영역 (가운데 정렬) ── */}
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-5">

          {/* 페이즈 스테퍼 */}
          <div className="w-full max-w-2xl">
            <PhaseStepperDesktop
              phase={phase ?? 'powder'}
              isMyTurn={stepperActiveTurn}
              isSpectator={isSpectator}
              firstNick={firstPlayer.nickname}
              secondNick={secondPlayer.nickname}
              myIsFirst={mySide === firstSide}
            />
          </div>

          {/* 해·달·별 표식 행 */}
          <div className="w-full max-w-2xl">
            <Marks
              size="md"
              myContribution={gameData.selfPrivate?.myMarkContribution ?? null}
              pendingPowder={markRowPendingPowder}
              litMark={litMark}
              dimUnlit={isResolve || isRoundEnd}
            />
          </div>

          {/* 선 베팅 공개 배너 */}
          {isBetSecond && revealedBetFirst && (
            <div className="w-full max-w-2xl">
              <FirstBetRevealBanner
                firstBet={revealedBetFirst}
                firstSide={firstSide}
                firstNick={firstPlayer.nickname}
                isMyTurn={!isSpectator && myTurnInBet}
              />
            </div>
          )}

          {/* 입력 / 대기 / 정산 / 종료 */}
          <div className="w-full max-w-2xl">
            <PhaseArea ctx={ctx} />
          </div>

        </div>
      </div></div>
  );
}
