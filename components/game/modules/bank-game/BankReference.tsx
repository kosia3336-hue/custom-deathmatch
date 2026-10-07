'use client';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import OpponentInventoryTracker from './OpponentInventoryTracker';
import RoundHistoryTable from './RoundHistoryTable';
import ScorePanel from './ScorePanel';
import type { BankContextValue } from './hooks/useBankContext';

export function BankReference({ ctx }: { ctx: BankContextValue }) {
  const { gameData, firstSide, myId, mySide, showOpponentTracker } = ctx;
  if (!gameData) return null;
  return (
    <GameInfoStack>
      {firstSide && (
        <GameInfoPart title="점수" sizeToContent>
          <ScorePanel
            p1={gameData.players.p1}
            p2={gameData.players.p2}
            firstSide={firstSide}
            myId={myId}
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
      {showOpponentTracker && (
        <GameInfoPart title="상대 잔여 추리" sizeToContent>
          <OpponentInventoryTracker />
        </GameInfoPart>
      )}
    </GameInfoStack>
  );
}
