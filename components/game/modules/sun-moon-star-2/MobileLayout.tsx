'use client';

import { useEffect, useRef, useState } from 'react';
import { zeroOpponentEstimate } from './types';
import MarkRow from './MarkRow';
import PowderTrack from './PowderTrack';
import OpponentPowderTracker from './OpponentPowderTracker';
import FirstBetRevealBanner from './FirstBetRevealBanner';
import RoundHistoryTable from './RoundHistoryTable';
import MobileHeader from './MobileHeader';
import ScoreBar from './ScoreBar';
import PhaseArea from './PhaseArea';
import BetInput from './BetInput';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import { GameFrame } from '@/components/game/GameFrame';
import Modal from '@/components/ui/Modal';

/* ════════════════════════════════════════════════════════════
 * MobileLayout — 모바일 1컬럼 입력 우선 레이아웃 (≤ 1023px)
 *   · sticky 헤더 + 컴팩트 stepper 만 항상 보이게
 *   · 입력 카드(PhaseArea)는 반드시 첫 화면 안쪽에 위치
 *   · 부가 정보(풀 PowderTrack, 상대 추리, 라운드 기록)는 details 접힘
 *   · 가로 스크롤 절대 발생 금지: overflow-x-hidden + min-w-0
 *   · 자동 스크롤 ref/effect 는 이 컴포넌트 안에서만 정의
 * ════════════════════════════════════════════════════════════ */

type PanelKind = 'tracker' | 'track' | 'history';

/** 아래 단추로 여는 참고 패널들. 늘 펼쳐 두면 조작부만으로 화면이 찬다. */
const PANEL_TITLE: Record<PanelKind, string> = {
  tracker: '상대 빛가루 추리',
  track: '빛가루 트랙',
  history: '라운드 기록',
};

interface Props {
  ctx: SMS2ContextValue;
}

export default function MobileLayout({ ctx }: Props) {
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
    isBetFirst,
    isBetSecond,
    mySubmittedPowder,
    myBetConfirmed,
    myTurnInBet,
    isMyInputTurn,
    revealedBetFirst,
    markRowPendingPowder,
    litMark,
    showTracker,
    opponentEstimate,
    setOpponentEstimate,
    pendingBet,
    setPendingBet,
    resetBet,
    handleSubmitBet,
    submitting,
  } = ctx;

  /* ── 베팅 bottom-sheet 표시 여부 ── */
  const [panel, setPanel] = useState<PanelKind | null>(null);
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
        info={<div className="flex w-full min-w-0 flex-col gap-1">
        <MobileHeader
          round={gameData.round}
          maxRound={gameData.maxRound}
          phase={phase ?? 'powder'}
          suddenDeath={gameData.suddenDeath}
          firstNick={firstPlayer.nickname}
        />

        {/*
          단계 표시줄(43px)은 좁은 화면에서 뺐다. 머리말의 단계 칩과 입력판
          제목이 같은 말을 하고 있고, 그 43px 이 없으면 입력판이 잘린다.
          넓은 화면은 DesktopLayout 이 따로 그린다.
        */}

        <ScoreBar
          p1={gameData.players.p1}
          p2={gameData.players.p2}
          firstSide={firstSide}
          myId={myId}
        />
        </div>}
        controls={
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            {/* 베팅 시트는 내 차례에 저절로 열린다 — 여는 단추가 따로 없다. */}
            <div className="flex gap-1.5">
              {showTracker && opponentEstimate && opponent && (
                <button
                  type="button"
                  onClick={() => setPanel('tracker')}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-xs font-semibold text-gray-600"
                >
                  🔍 추리
                </button>
              )}
              <button
                type="button"
                onClick={() => setPanel('track')}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-xs font-semibold text-gray-600"
              >
                빛가루 트랙
              </button>
              {gameData.history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPanel('history')}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-xs font-semibold text-gray-600"
                >
                  기록 ({gameData.history.length})
                </button>
              )}
            </div>
          </div>
        }
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

      {/*
        접이식 세 개(추리·트랙·기록)를 모달로 옮겼다. 아래에 다 펼쳐 두면
        조작부만으로 화면이 차서 무대가 사라진다.
      */}
      <Modal open={panel !== null} onClose={() => setPanel(null)} title={PANEL_TITLE[panel ?? 'track']}>
        <div className="max-h-[60dvh] overflow-y-auto overscroll-contain">
        {/* 상대 빛가루 추리 (details 접힘) */}
        {showTracker && opponentEstimate && opponent && (
          <details className="w-full min-w-0 rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600">
              🔍 상대 빛가루 추리
            </summary>
            <div className="border-t border-gray-100 p-2">
              <OpponentPowderTracker
                key={`tracker-${opponent.powderStage}`}
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
          </details>
        )}

        {/* 풀 PowderTrack (details 접힘) — ScoreBar 로는 부족할 때 펼쳐 봄 */}
        <details className="w-full min-w-0 rounded-xl border border-gray-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600">
            🌌 빛가루 단계 상세
          </summary>
          <div className="border-t border-gray-100 p-2">
            <PowderTrack
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
          </div>
        </details>

        {/* 라운드 기록 (details 접힘) */}
        {gameData.history.length > 0 && (
          <details className="w-full min-w-0 rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600">
              📜 라운드 기록 ({gameData.history.length})
            </summary>
            <div className="border-t border-gray-100 px-3 py-2">
              <RoundHistoryTable
                history={gameData.history}
                mySide={mySide}
                players={gameData.players}
              />
            </div>
          </details>
        )}
        </div>
      </Modal>


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
