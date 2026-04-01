'use client';

import type { DSCPlayerInfo, Owner } from '@/shared/types/double-sided-chess';
import { OWNER_COLOR } from './constants';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import TurnTimer from './TurnTimer';

interface Props {
  turnNumber: number;
  players: { first: DSCPlayerInfo; second: DSCPlayerInfo };
  currentOwner: Owner;
}

function PlayerCard({
  player,
  owner,
  isCurrent,
  remaining,
}: {
  player: DSCPlayerInfo;
  owner: Owner;
  isCurrent: boolean;
  remaining: number | null;
}) {
  const colors = OWNER_COLOR[owner];
  return (
    <div
      className={`rounded-lg border p-3 ${
        isCurrent ? `border-indigo-300 ${colors.light}` : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-4 w-4 rounded-full ${colors.bg}`} />
        <span className="text-sm font-bold text-gray-900">{player.nickname}</span>
      </div>
      {isCurrent && <div className="mt-1 text-xs font-medium text-indigo-600">◀ 현재 턴</div>}
      {isCurrent && remaining != null && (
        <div className="mt-1"><TurnTimer remaining={remaining} /></div>
      )}
    </div>
  );
}

export default function InfoPanel({ turnNumber, players, currentOwner }: Props) {
  const { remaining } = useTurnTimer();

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-gray-500">턴 #{turnNumber}</div>
      <PlayerCard
        player={players.second}
        owner="second"
        isCurrent={currentOwner === 'second'}
        remaining={currentOwner === 'second' ? remaining : null}
      />
      <PlayerCard
        player={players.first}
        owner="first"
        isCurrent={currentOwner === 'first'}
        remaining={currentOwner === 'first' ? remaining : null}
      />
    </div>
  );
}
