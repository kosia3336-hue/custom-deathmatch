'use client';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import type { MBNWTile, MBNWTileColor, MultipleBnwGameData } from '@/shared/types/multiple-bnw';
import InfoPanel from './InfoPanel';
import OpponentTileTracker from './OpponentTileTracker';

export function MultipleBnwSidePanel({
  gameData,
  myId,
  showTracker,
  trackedOpponentUsed,
  onTrackerToggle,
  opponentCurrentColor,
  inkWash,
}: {
  gameData: MultipleBnwGameData;
  myId: string;
  showTracker: boolean;
  trackedOpponentUsed: MBNWTile[];
  onTrackerToggle: (tile: MBNWTile) => void;
  opponentCurrentColor: MBNWTileColor | null;
  inkWash: boolean;
}) {
  return (
    <GameInfoStack className={inkWash ? 'skin-ink-wash-memo' : undefined}>
      {showTracker && (
        <GameInfoPart
          title="메모 - 상대 타일 추리"
          className="border-0 bg-transparent shadow-none"
          sizeToContent
        >
          <OpponentTileTracker
            markedTiles={trackedOpponentUsed}
            onToggle={onTrackerToggle}
            opponentCurrentColor={opponentCurrentColor}
          />
        </GameInfoPart>
      )}
      <InfoPanel players={gameData.players} roundHistory={gameData.roundHistory} myId={myId} />
    </GameInfoStack>
  );
}
