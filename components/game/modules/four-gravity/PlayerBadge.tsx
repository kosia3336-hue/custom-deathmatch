import type { FourGravityGameData } from '@/shared/types/four-gravity';
import TurnTimer from './TurnTimer';
import { STONE_COLOR_CLASS } from './constants';

interface Props {
  player: FourGravityGameData['players']['black'];
  color: 'black' | 'white';
  isCurrent: boolean;
  remaining: number | null;
}

export default function PlayerBadge({ player, color, isCurrent, remaining }: Props) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1 ${
        isCurrent ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''
      }`}
    >
      <span className={`h-3 w-3 rounded-full ${STONE_COLOR_CLASS[color]}`} />
      <span className="text-sm font-medium text-gray-900">{player.nickname}</span>
      {isCurrent && remaining != null && <TurnTimer remaining={remaining} compact />}
      {isCurrent && remaining == null && <span className="text-xs text-indigo-600">◀</span>}
    </div>
  );
}
