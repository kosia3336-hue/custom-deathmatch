'use client';

import type { IndianPokerGameData } from '@/shared/types/indian-poker';
import PlayerArea from './PlayerArea';

export default function Scoreboard({
  data,
  myId,
  showTitle = true,
}: {
  data: IndianPokerGameData;
  myId: string;
  showTitle?: boolean;
}) {
  const entries = Object.entries(data.players);
  const orderedPlayers = [
    ...entries.filter(([id]) => id === myId),
    ...entries.filter(([id]) => id !== myId),
  ];

  return (
    <section aria-label="플레이어 점수판" className="min-w-0">
      {showTitle && (
        <h2 className="text-cdm-fg-muted mb-1 text-[11px] font-semibold">플레이어 점수판</h2>
      )}
      <div className="grid grid-cols-2 gap-2">
        {orderedPlayers.map(([id, player]) => (
          <PlayerArea
            key={id}
            player={player}
            isMe={id === myId}
            isCurrentTurn={data.phase === 'betting' && id === data.currentTurnId}
          />
        ))}
      </div>
    </section>
  );
}
