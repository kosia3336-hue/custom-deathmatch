'use client';

import type { DSCPlayerInfo, Owner } from '@/shared/types/double-sided-chess';
import { OWNER_COLOR } from './constants';

interface Props {
  players: { first: DSCPlayerInfo; second: DSCPlayerInfo };
  currentOwner: Owner;
}

function PlayerCard({
  player,
  owner,
  isCurrent,
}: {
  player: DSCPlayerInfo;
  owner: Owner;
  isCurrent: boolean;
}) {
  const colors = OWNER_COLOR[owner];
  return (
    <div
      className={`rounded-lg border p-3 ${
        isCurrent ? 'border-cdm-primary bg-cdm-primary/20' : 'border-cdm-ink-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-4 w-4 rounded-full ${colors.bg}`} />
        <span className="text-sm font-bold text-cdm-ink-fg">{player.nickname}</span>
      </div>
      {isCurrent && <div className="mt-1 text-xs font-medium text-indigo-300">◀ 현재 턴</div>}
    </div>
  );
}

export default function InfoPanel({ players, currentOwner }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <PlayerCard
        player={players.second}
        owner="second"
        isCurrent={currentOwner === 'second'}
      />
      <PlayerCard
        player={players.first}
        owner="first"
        isCurrent={currentOwner === 'first'}
      />
    </div>
  );
}
