'use client';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { type SkinTheme } from '@/lib/skins/registry';
import type { SBNWGameData } from '@/shared/types/silper-bnw';
import { computeOpponentUsed } from './computeOpponentUsed';
import OpponentTileTracker from './OpponentTileTracker';
import { RoundHistoryTable } from './RoundHistoryTable';
import { ScoreCard } from './ScoreCard';

export function SilperSidePanel({
  gameData,
  myId,
  opponentId,
  skin,
  showTracker,
}: {
  gameData: SBNWGameData;
  myId: string;
  opponentId: string | null;
  skin: SkinTheme | null;
  showTracker: boolean;
}) {
  const opponentUsed = opponentId ? computeOpponentUsed(gameData.roundHistory, opponentId) : null;
  return (
    <GameInfoStack>
      {showTracker && opponentUsed && (
        <GameInfoPart title="메모 - 상대 타일 추리" sizeToContent>
          <OpponentTileTracker
            opponentUsed={opponentUsed}
            rematchIndex={gameData.rematchIndex}
            skin={skin}
          />
        </GameInfoPart>
      )}
      <GameInfoPart title="점수" sizeToContent>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(gameData.players)
            .sort(([a], [b]) => Number(b === myId) - Number(a === myId))
            .map(([id, player]) => (
              <ScoreCard
                key={id}
                info={player}
                isMe={id === myId}
                isFirst={id === gameData.firstPlayerId}
              />
            ))}
        </div>
        {gameData.rematchIndex > 0 && (
          <p className="bg-cdm-accent/15 text-cdm-accent mt-2 rounded-md px-2 py-1.5 text-center text-xs font-bold">
            재대결 {gameData.rematchIndex}회차
          </p>
        )}
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
      {gameData.segmentsHistory.length > 0 && (
        <GameInfoPart title="지난 세그먼트">
          <div className="text-cdm-fg-muted space-y-1 text-xs">
            {gameData.segmentsHistory.map((segment) => (
              <div key={segment.rematchIndex} className="tabular-nums">
                #{segment.rematchIndex} · {segment.rounds.length}R ·{' '}
                {segment.resolution === 'rematchNeeded'
                  ? '재대결'
                  : segment.winnerId
                    ? `${gameData.players[segment.winnerId]?.nickname ?? '승자'} 승`
                    : '무승부'}
              </div>
            ))}
          </div>
        </GameInfoPart>
      )}
    </GameInfoStack>
  );
}
