'use client';
import { useGameHud } from '@/hooks/useGameHud';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import type { BankGameData } from '@/shared/types/bank-game';
import { memo } from 'react';
import GameLayout from './GameLayout';

import GameLoading from '@/components/game/GameLoading';

import { seatStage, turnStage } from '@/lib/gameSeat';
import { useBankContext } from './hooks/useBankContext';
import PhaseTransitionOverlay from './PhaseTransitionOverlay';
import TreasuryFieldFx from './skins/TreasuryFieldFx';

/** 연결은 index, 파생 상태/액션은 useBankContext, PC/모바일은 같은 GameLayout을 사용한다. */

function BankView(props: GameModuleViewProps<BankGameData>) {
  const ctx = useBankContext(props);
  const {
    gameData,
    isSpectator,
    phase,
    stepperActiveTurn,
    firstPlayer,
    secondPlayer,
    myIsFirst,
    isTreasury,
  } = ctx;

  /*
    상단 바에 얹을 것 — 라운드, 선/후와 진행 단계.
    라운드와 선/후는 gameData 안에 있어 셸이 알 수 없으므로 여기서 넘긴다.
    (RoomLayoutContext 의 GameHud 주석 참고)
  */

  /*
    자리와 단계를 같이 적는다 — '선 플레이어 베팅' 만으로는 그게 나인지 상대인지
    알 수 없다. 은행놀이는 선의 베팅을 보고 후가 거는 구조라 특히 그렇다.
    (lib/gameSeat.ts)
  */
  const bankSeat = ctx.isSpectator ? null : myIsFirst ? '선' : '후';
  const bankMyTurn =
    (phase === 'firstSubmit' && myIsFirst) || (phase === 'secondSubmit' && !myIsFirst);
  const phaseLabel = seatStage(
    bankSeat,
    phase === 'firstSubmit' || phase === 'secondSubmit'
      ? turnStage({
          finished: false,
          isSpectator: ctx.isSpectator,
          isMyTurn: bankMyTurn,
          spectatorStage: phase === 'firstSubmit' ? '선 베팅' : '후 베팅',
        })
      : phase === 'firstReveal'
        ? '선 베팅 공개'
        : phase === 'reveal' || phase === 'roundEnd'
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

  return (
    /*
      GameShell 의 상자를 그대로 채운다. relative + h-full 로 두면 조상 높이가
      '내용만큼' 이라 높이가 풀리지 않고, 그 안의 GameFrame(absolute inset-0)이
      납작해진다. absolute 도 위치 기준이 되므로 스킨의 fx 레이어는 그대로 붙는다.
    */
    <div
      className={`absolute inset-0 flex min-w-0 flex-col overflow-hidden ${
        isTreasury ? 'skin-treasury-field' : ''
      }`}
    >
      <style>{`
        @keyframes bankFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bankSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bankBannerPop {
          0%   { transform: scale(0.96); opacity: 0; }
          60%  { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes bankAmountReveal {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes bankResultPop {
          0%   { transform: scale(0.7); opacity: 0; }
          65%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
      `}</style>

      {isTreasury && <TreasuryFieldFx />}

      <PhaseTransitionOverlay
        phase={phase ?? 'firstSubmit'}
        isMyTurn={stepperActiveTurn}
        isSpectator={isSpectator}
        firstNick={firstPlayer?.nickname ?? ''}
        secondNick={secondPlayer?.nickname ?? ''}
        myIsFirst={myIsFirst}
      />

      <GameLayout ctx={ctx} />
    </div>
  );
}

export default memo(BankView);
