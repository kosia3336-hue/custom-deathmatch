'use client';

import type { DSCPlayerInfo, Owner } from '@/shared/types/double-sided-chess';
import { OWNER_COLOR } from './constants';
import TurnTimer from './TurnTimer';

interface Props {
  player: DSCPlayerInfo;
  owner: Owner;
  isCurrent: boolean;
  remaining: number | null;
}

export default function PlayerBadge({ player, owner, isCurrent, remaining }: Props) {
  const colors = OWNER_COLOR[owner];
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1 ${
        isCurrent ? `${colors.light} ring-1 ${colors.ring}` : ''
      }`}
    >
      <span className={`h-3 w-3 rounded-full ${colors.bg}`} />
      <span className="text-sm font-medium text-gray-900">{player.nickname}</span>
      {isCurrent && remaining != null && <TurnTimer remaining={remaining} compact />}
      {isCurrent && remaining == null && <span className="text-xs text-indigo-600">◀</span>}
    </div>
  );
}
