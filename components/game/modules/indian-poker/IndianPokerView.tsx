'use client';

import { useEffect } from 'react';
import type { SkinTheme } from '@/lib/skins/registry';
import type { IndianPokerAction, IndianPokerGameData } from '@/shared/types/indian-poker';
import CardArea from './CardArea';
import BettingPanel from './BettingPanel';
import HandResult from './HandResult';
import DeckInfo from './DeckInfo';
import { GameFrame } from '@/components/game/GameFrame';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { useIndianPokerTools } from './useIndianPokerTools';
import { buildIndianPokerViewModel } from './viewModel';
import { useIndianPokerPresentation } from './useIndianPokerPresentation';

/** 실제 경기와 로컬 미리보기가 같은 화면을 사용한다. 서버 전송은 호출자가 담당한다. */
export default function IndianPokerView({
  gameData,
  myId,
  isSpectator,
  skin,
  onAction,
  remaining = null,
}: {
  gameData: IndianPokerGameData;
  myId: string;
  isSpectator: boolean;
  skin?: SkinTheme | null;
  onAction: (action: IndianPokerAction) => void;
  remaining?: number | null;
}) {
  const { info, tools } = useIndianPokerTools(gameData, myId);

  const model = buildIndianPokerViewModel(gameData, myId, isSpectator);
  const { showShuffle, shuffleAnte, dealStep } = useIndianPokerPresentation(gameData, myId, skin);
  const { setHud, setHeaderBelow } = useRoomLayout();
  const round = gameData.round;
  const phaseLabel = model.phaseLabel;

  useEffect(() => {
    setHud({
      // 덱이 도는 게임이라 총 라운드가 정해져 있지 않다. 몇 번째인지만 센다.
      round: `${round}R`,
      order: phaseLabel,
    });
    return () => setHud(null);
  }, [setHud, round, phaseLabel]);
  useEffect(() => {
    setHeaderBelow(
      <DeckInfo
        deckRemaining={gameData.deckRemaining}
        deckCycle={gameData.deckCycle}
        ante={gameData.ante}
        pot={gameData.pot}
      />,
    );
    return () => setHeaderBelow(null);
  }, [setHeaderBelow, gameData.deckRemaining, gameData.deckCycle, gameData.ante, gameData.pot]);

  return (
    <>
      {skin !== 'nocturne' && (
        <div
          aria-hidden={!showShuffle}
          className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-500 ${
            showShuffle ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`flex flex-col items-center gap-4 rounded-3xl border border-indigo-400/30 bg-indigo-900/95 px-12 py-8 text-center text-white shadow-2xl backdrop-blur-sm transition-transform duration-500 ${
              showShuffle ? 'scale-100' : 'scale-90'
            }`}
          >
            <div>
              <p className="text-2xl font-bold tracking-wide">카드를 셔플합니다</p>
              <p className="mt-1 text-sm text-indigo-300">앤트 {shuffleAnte}개로 인상됩니다</p>
            </div>
          </div>
        </div>
      )}

      <GameFrame
        info={info}
        tools={tools}
        controls={
          <div className="w-full">
            {model.betting && (
              <BettingPanel
                key={model.inputKey}
                data={gameData}
                model={model}
                spectator={isSpectator}
                skin={skin}
                remaining={remaining}
                onAction={onAction}
              />
            )}
          </div>
        }
      >
        <div className="relative flex h-full w-full max-w-lg flex-col items-center justify-center gap-2 overflow-hidden">
          <CardArea
            communityCards={gameData.communityCards}
            myPlayer={model.tableMe}
            opponentPlayer={model.tableOpponent}
            revealMyCard={model.result}
            round={gameData.round}
            isSpectator={isSpectator}
            skin={skin}
            dealStep={dealStep}
            showShuffle={showShuffle}
          />

          {model.result && (
            <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
              <HandResult
                key={`${gameData.round}:${gameData.phase}`}
                showdownData={gameData.showdownData}
                dieData={gameData.dieData}
                players={gameData.players}
                winner={gameData.winner}
                winType={gameData.winType}
                communityCards={gameData.communityCards}
                skin={skin}
              />
            </div>
          )}

          {gameData.phase === 'dealing' && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
              <div className="animate-pulse text-gray-400">● ● ●</div>
              <p className="text-sm text-gray-500">카드를 배분하는 중...</p>
            </div>
          )}
        </div>
      </GameFrame>
    </>
  );
}
