'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect } from 'react';

import PhaseTransitionOverlay from './PhaseTransitionOverlay';
import MobileLayout from './MobileLayout';
import DesktopLayout from './DesktopLayout';
import { useSMS2Context } from './hooks/useSMS2Context';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import ScorePanel from './ScorePanel';
import DalmajiScorePanel from './skins/DalmajiScorePanel';
import PowderTrack from './PowderTrack';
import DalmajiPowderTrack from './skins/DalmajiPowderTrack';
import DalmajiFieldShell from './skins/DalmajiFieldShell';
import OpponentPowderTracker from './OpponentPowderTracker';
import RoundHistoryTable from './RoundHistoryTable';
import { zeroOpponentEstimate } from './types';
import { seatStage, turnStage, submitStage } from '@/lib/gameSeat';
import { opponentDisplayName } from '@/lib/anonymousOpponents';

/* ════════════════════════════════════════════════════════════
 * 해달별 II — 메인 게임 컴포넌트 (얇은 컨테이너)
 *   · useSMS2Context 가 모든 상태/액션/파생값을 한 객체로 묶어 반환
 *   · MobileLayout (≤ 1023px) / DesktopLayout (≥ 1024px) 를
 *     각각 lg:hidden / hidden lg:flex 로 분기 마운트
 *   · 두 레이아웃은 완전히 별개 파일로 분리 — 한쪽 수정이 반대편 영향 X
 *   · PhaseTransitionOverlay / 키프레임 스타일 만 공통 마운트
 * ════════════════════════════════════════════════════════════ */

export default function SunMoonStar2Game() {
  const ctx = useSMS2Context();
  const {
    gameData,
    isSpectator,
    phase,
    stepperActiveTurn,
    firstPlayer,
    secondPlayer,
    myIsFirstFlag,
  } = ctx;
  const { setHud } = useRoomLayout();
  /*
    자리와 단계를 같이 (lib/gameSeat.ts). 빛가루는 동시 제출이라 '내 차례' 가
    뜻이 없어 낸 뒤에는 '상대 대기' 로 바꾼다.
  */
  const smsSeat = isSpectator ? null : myIsFirstFlag ? '선' : '후';
  const phaseLabel = seatStage(
    smsSeat,
    phase === 'powder'
      ? submitStage({
          finished: false,
          isSpectator,
          submitted: ctx.myPlayer?.submittedPowder === true,
          pending: '빛가루 제출',
        })
      : phase === 'betFirst' || phase === 'betSecond'
        ? turnStage({
            finished: false,
            isSpectator,
            isMyTurn: (phase === 'betFirst') === myIsFirstFlag,
            spectatorStage: phase === 'betFirst' ? '선 베팅' : '후 베팅',
          })
        : phase === 'resolve' || phase === 'roundEnd'
          ? '라운드 정산'
          : phase === 'finished'
            ? '종료'
            : undefined,
  );

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${gameData.maxRound}R`,
      order: phaseLabel,
      memo: <SunMoonStarMemo ctx={ctx} />,
    });
    return () => setHud(null);
  // ctx 객체 전체는 매 렌더마다 새로 생겨 setHud와 렌더 루프를 만들 수 있어 실제 메모 입력만 추적한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHud, gameData, phaseLabel, ctx.opponentEstimate, ctx.showTracker, ctx.mySide]);

  if (!gameData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GameLoading label="로딩 중" />
      </div>
    );
  }

  const game = (
    <>
      <style>{`
        @keyframes sms2FadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sms2SlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sms2LitPop {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes sms2StepPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.5); }
          50%      { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
        }
        @keyframes sms2BannerPop {
          0%   { transform: scale(0.96); opacity: 0; }
          60%  { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes sms2SlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      <PhaseTransitionOverlay
        phase={phase ?? 'powder'}
        isMyTurn={stepperActiveTurn}
        isSpectator={isSpectator}
        firstNick={firstPlayer?.nickname ?? ''}
        secondNick={secondPlayer?.nickname ?? ''}
        myIsFirst={myIsFirstFlag}
      />

      {/* 모바일 (≤ 1023px) */}
      {/*
        GameFrame(absolute inset-0)이 셸 상자를 기준으로 잡히도록 이 래퍼도
        상자를 그대로 채운다. relative + h-full 이면 높이가 풀리지 않는다.
      */}
      <div className="absolute inset-0 flex min-w-0 flex-col overflow-x-hidden lg:hidden">
        <MobileLayout ctx={ctx} />
      </div>

      {/* 데스크탑 (≥ 1024px) */}
      <div className="hidden h-full min-w-0 flex-1 lg:flex lg:flex-col">
        <DesktopLayout ctx={ctx} />
      </div>
    </>
  );

  if (!ctx.dalmaji) return game;
  return <DalmajiFieldShell skyMark={ctx.litMark}>{game}</DalmajiFieldShell>;
}

function SunMoonStarMemo({ ctx }: { ctx: SMS2ContextValue }) {
  const {
    gameData,
    isSpectator,
    myId,
    myPlayer,
    opponent,
    mySide,
    firstSide,
    showTracker,
    opponentEstimate,
    setOpponentEstimate,
    dalmaji,
  } = ctx;
  const Scores = dalmaji ? DalmajiScorePanel : ScorePanel;
  const Track = dalmaji ? DalmajiPowderTrack : PowderTrack;
  if (!gameData || !firstSide) return null;
  const left = !isSpectator && myPlayer ? myPlayer : gameData.players.p1;
  const right = !isSpectator && opponent ? opponent : gameData.players.p2;
  return (
    <GameInfoStack>
      <GameInfoPart title="점수" sizeToContent>
        <Scores
          p1={gameData.players.p1}
          p2={gameData.players.p2}
          firstSide={firstSide}
          myId={myId}
        />
      </GameInfoPart>
      {showTracker && opponentEstimate && opponent && (
        <GameInfoPart title="상대 빛가루 추리">
          <OpponentPowderTracker
            stageNow={opponent.powderStage}
            stagePrev={opponentEstimate.basedOnStagePrev}
            estimate={opponentEstimate}
            onChange={setOpponentEstimate}
            onReset={() =>
              setOpponentEstimate(
                zeroOpponentEstimate(opponentEstimate.basedOnStagePrev, opponent.powderStage),
              )
            }
          />
        </GameInfoPart>
      )}
      <GameInfoPart title="빛가루 트랙" sizeToContent>
        <Track
          leftLabel={!isSpectator && myPlayer ? '나' : left.nickname}
          leftStage={left.powderStage}
          leftRemain={
            !isSpectator && myPlayer ? (gameData.selfPrivate?.powderRemain ?? null) : null
          }
          leftIsFirst={left.side === gameData.firstPlayerSide}
          leftChips={left.chips}
          rightLabel={
            !isSpectator && opponent ? opponentDisplayName(opponent.nickname) : right.nickname
          }
          rightStage={right.powderStage}
          rightRemain={null}
          rightIsFirst={right.side === gameData.firstPlayerSide}
          rightChips={right.chips}
        />
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        <RoundHistoryTable history={gameData.history} mySide={mySide} players={gameData.players} />
      </GameInfoPart>
    </GameInfoStack>
  );
}
