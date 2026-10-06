'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect } from 'react';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import RoundHistoryTable from './RoundHistoryTable';
import OpponentInventoryTracker from './OpponentInventoryTracker';
import PhaseTransitionOverlay from './PhaseTransitionOverlay';
import MobileLayout from './MobileLayout';
import DesktopLayout from './DesktopLayout';
import { useBankContext } from './hooks/useBankContext';
import TreasuryFieldFx from './skins/TreasuryFieldFx';
import ScorePanel from './ScorePanel';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { seatStage, turnStage } from '@/lib/gameSeat';

/* ════════════════════════════════════════════════════════════
 * 은행놀이 — 메인 게임 컴포넌트 (얇은 컨테이너)
 *   · useBankContext 가 모든 상태/액션/파생값을 한 객체로 묶어 반환
 *   · MobileLayout (≤ 1023px) / DesktopLayout (≥ 1024px) 를
 *     각각 lg:hidden / hidden lg:flex 로 분기 마운트
 *   · 두 레이아웃은 완전히 별개 파일로 분리 — 한쪽 수정이 반대편 영향 X
 *   · PhaseTransitionOverlay / 키프레임 스타일 만 공통 마운트
 * ════════════════════════════════════════════════════════════ */

export default function BankGame() {
  const ctx = useBankContext();
  const {
    gameData,
    isSpectator,
    phase,
    stepperActiveTurn,
    firstSide,
    firstPlayer,
    secondPlayer,
    myIsFirst,
    isTreasury,
    mySide,
  } = ctx;

  /*
    상단 바에 얹을 것 — 라운드, 선/후, 진행 바, 그리고 좁은 화면용 메모.
    라운드와 선/후는 gameData 안에 있어 셸이 알 수 없으므로 여기서 넘긴다.
    (RoomLayoutContext 의 GameHud 주석 참고)
  */
  const { setHud } = useRoomLayout();
  const round = gameData?.round ?? 0;
  const historyLen = gameData?.history?.length ?? 0;
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

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${round} / ${gameData.maxRound}R`,
      order: phaseLabel,
      memo: (
        <GameInfoStack>
          {firstSide && (
            <GameInfoPart title="점수" sizeToContent>
              <ScorePanel
                p1={gameData.players.p1}
                p2={gameData.players.p2}
                firstSide={firstSide}
                myId={ctx.myId}
              />
            </GameInfoPart>
          )}
          <GameInfoPart title="라운드 기록">
            <RoundHistoryTable
              history={gameData.history}
              mySide={mySide}
              players={gameData.players}
              variant="mobile"
            />
          </GameInfoPart>
          {ctx.showOpponentTracker && (
            <GameInfoPart title="상대 잔여 추리" sizeToContent>
              <OpponentInventoryTracker />
            </GameInfoPart>
          )}
        </GameInfoStack>
      ),
    });
    return () => setHud(null);
  }, [
    setHud,
    gameData,
    round,
    historyLen,
    myIsFirst,
    mySide,
    phaseLabel,
    ctx.myId,
    ctx.showOpponentTracker,
    firstSide,
  ]);

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
        @keyframes bankStepPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.5); }
          50%      { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
        }
        @keyframes bankSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
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

      {/* 모바일 (≤ 1023px) */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-x-hidden lg:hidden">
        <MobileLayout ctx={ctx} />
      </div>

      {/* 데스크탑 (≥ 1024px) */}
      <div className="hidden h-full min-w-0 flex-1 lg:flex lg:flex-col">
        <DesktopLayout ctx={ctx} />
      </div>
    </div>
  );
}
