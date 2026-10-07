'use client';
import { useGameHud } from '@/hooks/useGameHud';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';
import { memo } from 'react';
import GameLayout from './GameLayout';

import GameLoading from '@/components/game/GameLoading';

import { seatStage, submitStage, turnStage } from '@/lib/gameSeat';
import { useSMS2Context } from './hooks/useSMS2Context';
import PhaseTransitionOverlay from './PhaseTransitionOverlay';
import DalmajiFieldShell from './skins/DalmajiFieldShell';

/** 공통 View 한 벌로 PC 도킹 / 모바일 상·하 배치를 공유한다. */

function SunMoonStar2View(props: GameModuleViewProps<SMS2GameData>) {
  const ctx = useSMS2Context(props);
  const {
    gameData,
    isSpectator,
    phase,
    stepperActiveTurn,
    firstPlayer,
    secondPlayer,
    myIsFirstFlag,
  } = ctx;
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
          pending: '(공동 차례) 빛가루 제출',
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

  useGameHud(
    gameData ? { round: `${gameData.round} / ${gameData.maxRound}R`, order: phaseLabel } : null,
  );

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

      <GameLayout ctx={ctx} />
    </>
  );

  if (!ctx.dalmaji) return game;
  return <DalmajiFieldShell skyMark={ctx.litMark}>{game}</DalmajiFieldShell>;
}

export default memo(SunMoonStar2View);
