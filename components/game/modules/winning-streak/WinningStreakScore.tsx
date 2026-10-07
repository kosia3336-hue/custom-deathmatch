import type { WinningStreakGameData } from '@/shared/types/winning-streak';
import { StatLine } from './StatLine';

/** 점수판은 PC·모바일 모두 게임판 바로 위에 한 번만 표시한다. */
export function WinningStreakScore({
  gameData,
  myId,
}: {
  gameData: WinningStreakGameData;
  myId: string;
}) {
  const ids = Object.keys(gameData.players).sort((a, b) => Number(b === myId) - Number(a === myId));
  return (
    <section
      aria-label="점수판"
      className="game-info-part border-cdm-border bg-cdm-bg-elev-1 rounded-lg border p-2"
    >
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
    </section>
  );
}
