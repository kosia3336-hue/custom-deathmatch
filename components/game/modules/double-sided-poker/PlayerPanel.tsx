'use client';
import { PlayingCard } from '@/components/game/cards';
import { cn } from '@/lib/utils';
import type {
  DoubleSidedPokerGameData,
  DoubleSidedPokerPlayerView,
} from '@/shared/types/double-sided-poker';
import { BetBoard } from './BetBoard';
import { SELECTION_LABEL } from './presentation';

export function PlayerPanel({
  player,
  playerId,
  gameData,
  myId,
  mirrored,
}: {
  player: DoubleSidedPokerPlayerView;
  playerId: string;
  gameData: DoubleSidedPokerGameData;
  myId: string;
  mirrored: boolean;
}) {
  const isCurrent = gameData.currentTurnId === playerId;
  const selection = player.selection;

  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <p className="text-cdm-fg truncate text-xs font-black">
          {player.nickname}
          {playerId === myId ? ' (나)' : ''}
        </p>
        <p className="text-cdm-fg-muted shrink-0 text-[11px] font-bold">
          {playerId === gameData.firstPlayerId ? '선' : '후'}
          {selection ? ` · ${SELECTION_LABEL[selection]}` : ' · 면 선택 전'}
        </p>
      </div>
    </div>
  );

  /*
    카드 줄은 낮게 유지한다. 여기서 아낀 높이가 그대로 베팅판으로 간다.
    어느 쪽이 앞·뒷면인지는 바로 붙어 있는 베팅판이 이미 말해 준다.
  */
  const cards = (
    <div className="flex items-center justify-center gap-2">
      {player.card && <PlayingCard value={player.card.front} face="front" size="sm" />}
      {player.card?.back != null && <PlayingCard value={player.card.back} face="back" size="sm" />}
      {player.card && player.card.back == null && (
        // 크기는 sm 카드(60×83)에 맞춘다. 나란히 놓였을 때 한 장만 작아 보이면 어색하다.
        <span className="border-cdm-border-strong bg-cdm-bg-elev-2 text-cdm-fg-subtle rounded-cdm-sm flex aspect-[60/83] w-[60px] items-center justify-center border text-lg font-black">
          ?
        </span>
      )}
    </div>
  );

  const board = (
    <BetBoard frontBet={player.frontBet} backBet={player.backBet} selection={selection} />
  );

  return (
    <section
      className={cn(
        'rounded-cdm-lg flex min-w-0 flex-col justify-center gap-2 border p-3 transition',
        isCurrent ? 'border-cdm-primary bg-cdm-primary-soft' : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      {mirrored ? (
        <>
          {header}
          {cards}
          {board}
        </>
      ) : (
        <>
          {board}
          {cards}
          {header}
        </>
      )}
    </section>
  );
}
