'use client';
import { cn } from '@/lib/utils';
import type { SeedSeotdaGameData, SeedSeotdaPlayerView } from '@/shared/types/seed-seotda';
import { HandCards } from './HandCards';

export function PlayerPanel({
  player,
  playerId,
  gameData,
  myId,
}: {
  player: SeedSeotdaPlayerView;
  playerId: string;
  gameData: SeedSeotdaGameData;
  myId: string;
}) {
  const current = gameData.currentTurnId === playerId;
  const evaluation = player.evaluation;
  const choiceLabel =
    player.seedChoice === 'used'
      ? '패 버림'
      : player.seedChoice === 'unused'
        ? '안 버림'
        : '선택 전';
  return (
    <section
      className={cn(
        'rounded-cdm-lg min-w-0 border p-1 text-center transition sm:p-3 lg:flex lg:items-center lg:justify-center lg:gap-4 lg:p-2',
        current
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-left">
        <div className="min-w-0">
          <p className="text-cdm-fg truncate text-xs font-black sm:text-sm">
            {player.nickname}
            {playerId === myId ? ' (나)' : ''}
          </p>
          <p className="text-cdm-fg-muted text-[11px] font-bold sm:text-xs">
            {playerId === gameData.firstPlayerId ? '선 플레이어' : '후 플레이어'} · {choiceLabel}
          </p>
        </div>
      </div>
      <HandCards player={player} />
      {evaluation && (
        <p className="text-cdm-fg mt-1 text-xs font-black sm:text-sm">
          {playerId === myId && gameData.phase !== 'round-result' ? '내 족보 · ' : ''}
          {evaluation.name}
        </p>
      )}
    </section>
  );
}
