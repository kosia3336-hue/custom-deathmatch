'use client';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import type { WinningStreakGameData } from '@/shared/types/winning-streak';
import { CardRow } from './CardRow';
import { RoundHistory } from './RoundHistory';
import { StatLine } from './StatLine';

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
      <GameInfoPart title="전적" sizeToContent>
        <div className="grid grid-cols-2 gap-2">
          {ids.map((id) => (
            <StatLine
              key={id}
              player={gameData.players[id]}
              label={id === myId ? '나' : '상대'}
              isMe={id === myId}
            />
          ))}
        </div>
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        <RoundHistory history={gameData.roundHistory} players={gameData.players} />
      </GameInfoPart>
      {opponent && (
        <GameInfoPart title="상대 잔여 카드" preferredBodyHeight={320} className="p-1">
          <CardRow cards={opponent.remainingCards} lastPlayed={opponent.lastPlayedCard} label="" />
        </GameInfoPart>
      )}
    </GameInfoStack>
  );
}
