'use client';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import type { WinningStreakGameData } from '@/shared/types/winning-streak';
import { CardRow } from './CardRow';
import { RoundHistory } from './RoundHistory';

export function WinningStreakSidePanel({
  gameData,
  myId,
}: {
  gameData: WinningStreakGameData;
  myId: string;
}) {
  const ids = Object.keys(gameData.players).sort((a, b) => Number(b === myId) - Number(a === myId));
  const opponentId = ids.find((id) => id !== myId);
  const opponent = opponentId ? gameData.players[opponentId] : undefined;
  return (
    <GameInfoStack>
      {opponent && (
        <GameInfoPart title="상대 잔여 카드" defaultOrder={10} sizeToContent>
          <CardRow cards={opponent.remainingCards} lastPlayed={opponent.lastPlayedCard} label="" />
        </GameInfoPart>
      )}
      <GameInfoPart title="라운드 기록" defaultOrder={20}>
        <RoundHistory history={gameData.roundHistory} players={gameData.players} />
      </GameInfoPart>
    </GameInfoStack>
  );
}
