import type { FourGravityGameData } from '@/shared/types/four-gravity';

interface Props {
  player: FourGravityGameData['players']['black'];
  color: 'black' | 'white';
  isCurrent: boolean;
}

export default function PlayerBadge({ player, color, isCurrent }: Props) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1 ${
        isCurrent ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''
      }`}
    >
      <span
        className={`h-3 w-3 rounded-full ${
          color === 'black' ? 'bg-[#1a1a2e]' : 'border border-gray-300 bg-white'
        }`}
      />
      <span className="text-sm font-medium text-gray-900">{player.nickname}</span>
      {isCurrent && <span className="text-xs text-indigo-600">◀</span>}
    </div>
  );
}
