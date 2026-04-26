'use client';

import MarkRow from './MarkRow';
import PowderTrack from './PowderTrack';
import OpponentPowderTracker from './OpponentPowderTracker';
import FirstBetRevealBanner from './FirstBetRevealBanner';
import RoundHistoryTable from './RoundHistoryTable';
import ScorePanel from './ScorePanel';
import PhaseStepperDesktop from './PhaseStepperDesktop';
import PhaseArea from './PhaseArea';
import { zeroOpponentEstimate } from './types';
import { PHASE_LABELS } from './constants';
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
    myId,
    myPlayer,
    opponent,
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
    showTracker,
    opponentEstimate,
    setOpponentEstimate,
  } = ctx;

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">

        {/* ── 메인 영역 (가운데 정렬) ── */}
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-5">

          {/* 라운드 헤더 */}
          <div className="w-full max-w-2xl text-center">
            <div className="flex items-center justify-center gap-2">
              {gameData.suddenDeath && (
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  서든데스
                </span>
              )}
              <span className="text-xl font-extrabold tabular-nums text-gray-800">
                R {gameData.round}
              </span>
              <span className="text-xs tabular-nums text-gray-400">/ {gameData.maxRound}</span>
              {phase && PHASE_LABELS[phase] && (
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  {PHASE_LABELS[phase]}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-sm text-amber-600">
              {firstPlayer.nickname} 선 👑
            </div>
          </div>

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
            <MarkRow
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

          {/* 상대 추리 */}
          {showTracker && opponentEstimate && opponent && (
            <div className="w-full max-w-2xl">
              <OpponentPowderTracker
                key={`tracker-desktop-${opponent.powderStage}`}
                stageNow={opponent.powderStage}
                stagePrev={opponentEstimate.basedOnStagePrev}
                estimate={opponentEstimate}
                onChange={setOpponentEstimate}
                onReset={() =>
                  setOpponentEstimate(
                    zeroOpponentEstimate(
                      opponentEstimate.basedOnStagePrev,
                      opponent.powderStage,
                    ),
                  )
                }
              />
            </div>
          )}
        </div>

        {/* ── 우측 사이드바 ── */}
        <div className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:gap-3 lg:border-l lg:border-gray-200 lg:p-4">
          <ScorePanel
            p1={gameData.players.p1}
            p2={gameData.players.p2}
            firstSide={firstSide}
            myId={myId}
          />

          <PowderTrack
            compact
            leftLabel={!isSpectator && myPlayer ? '나' : gameData.players.p1.nickname}
            leftStage={(!isSpectator && myPlayer ? myPlayer : gameData.players.p1).powderStage}
            leftRemain={
              !isSpectator && myPlayer
                ? gameData.selfPrivate?.powderRemain ?? null
                : null
            }
            leftIsFirst={
              (!isSpectator && myPlayer ? myPlayer : gameData.players.p1).side ===
              gameData.firstPlayerSide
            }
            leftChips={(!isSpectator && myPlayer ? myPlayer : gameData.players.p1).chips}
            rightLabel={
              !isSpectator && opponent ? opponent.nickname : gameData.players.p2.nickname
            }
            rightStage={
              (!isSpectator && opponent ? opponent : gameData.players.p2).powderStage
            }
            rightRemain={null}
            rightIsFirst={
              (!isSpectator && opponent ? opponent : gameData.players.p2).side ===
              gameData.firstPlayerSide
            }
            rightChips={(!isSpectator && opponent ? opponent : gameData.players.p2).chips}
          />

          {gameData.history.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                라운드 기록
              </p>
              <div className="flex-1 overflow-y-auto pr-1">
                <RoundHistoryTable
                  history={gameData.history}
                  mySide={mySide}
                  players={gameData.players}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
