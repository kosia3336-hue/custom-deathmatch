'use client';

import type { Direction, FourGravityGameData } from '@/shared/types/four-gravity';
import { DIR_LABEL } from './constants';

interface Props {
  turnNumber: number;
  players: FourGravityGameData['players'];
  currentColor: 'black' | 'white';
  neutralCount: number;
  lastGravity: Direction | null;
}

function PlayerCard({
  player,
  color,
  isCurrent,
}: {
  player: FourGravityGameData['players']['black'];
  color: 'black' | 'white';
  isCurrent: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        isCurrent ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-4 w-4 rounded-full ${
            color === 'black' ? 'bg-[#1a1a2e]' : 'border border-gray-300 bg-white'
          }`}
        />
        <span className="text-sm font-bold text-gray-900">{player.nickname}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">돌 {player.stoneCount}개</div>
      {isCurrent && <div className="mt-1 text-xs font-medium text-indigo-600">◀ 현재 턴</div>}
    </div>
  );
}

export default function InfoPanel({
  turnNumber,
  players,
  currentColor,
  neutralCount,
  lastGravity,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-gray-500">턴 #{turnNumber}</div>

      <PlayerCard player={players.black} color="black" isCurrent={currentColor === 'black'} />
      <PlayerCard player={players.white} color="white" isCurrent={currentColor === 'white'} />

      <div className="border-t border-gray-200 pt-3">
        <div className="text-xs text-gray-500">중립 돌: {neutralCount}개</div>
        <div className="mt-1 text-xs text-gray-500">
          금지 방향: {lastGravity ? DIR_LABEL[lastGravity] : '없음'}
        </div>
      </div>
    </div>
  );
}
