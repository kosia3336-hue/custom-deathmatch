'use client';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import type { BNW2GameData } from '@/shared/types/bnw2';
import { OpponentPointTracker } from './OpponentPointTracker';
import { RoundHistoryTable } from './RoundHistoryTable';

export function BNW2SidePanel({
  gameData,
  myId,
  showTracker,
  opponentStage,
  estimate,
  setEstimate,
}: {
  gameData: BNW2GameData;
  myId: string;
  showTracker: boolean;
  opponentStage?: number;
  estimate: number;
  setEstimate: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {showTracker && opponentStage != null && (
        <GameInfoPart
          title="메모 - 상대 잔여 추리"
          className="border-0 bg-transparent shadow-none"
          sizeToContent
        >
          <OpponentPointTracker
            opponentStage={opponentStage}
            estimate={estimate}
            setEstimate={setEstimate}
          />
        </GameInfoPart>
      )}
      <GameInfoPart title="점수" sizeToContent>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(gameData.players)
            .sort(([a], [b]) => Number(b === myId) - Number(a === myId))
            .map(([id, player]) => (
              <div
                key={id}
                className="bg-cdm-bg-elev-1 flex items-center justify-between rounded-md px-2.5 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">
                  {id === myId ? '나' : player.nickname}
                  {id === gameData.firstPlayerId && (
                    <span className="text-cdm-highlight ml-1 text-[11px]">선</span>
                  )}
                </span>
                <span className="ml-2 shrink-0 font-bold tabular-nums">{player.score}점</span>
              </div>
            ))}
        </div>
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        {gameData.roundHistory.length ? (
          <RoundHistoryTable
            history={gameData.roundHistory}
            players={gameData.players}
            myId={myId}
          />
        ) : (
          <p className="text-cdm-fg-muted text-xs">아직 기록이 없습니다.</p>
        )}
      </GameInfoPart>
    </div>
  );
}
