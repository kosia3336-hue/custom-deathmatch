'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import TimeLimitBadge from '@/components/ui/TimeLimitBadge';
import type { RoomSummary } from '@/shared/types';

interface Props {
  rooms: RoomSummary[];
  onJoin: (room: RoomSummary) => void;
  onSpectate: (room: RoomSummary) => void;
}

export default function RoomTable({ rooms, onJoin, onSpectate }: Props) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3 w-28 whitespace-nowrap">상태</th>
            <th className="px-4 py-3 whitespace-nowrap">게임</th>
            <th className="px-4 py-3">방 제목</th>
            <th className="px-4 py-3 whitespace-nowrap">방장</th>
            <th className="px-4 py-3 w-36 whitespace-nowrap">인원</th>
            <th className="px-4 py-3 w-16 whitespace-nowrap">관전</th>
            <th className="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const isWaiting = room.status === 'waiting';
            const isFull = room.currentPlayers >= room.maxPlayers;

            return (
              <tr
                key={room.id}
                className="border-b border-gray-100 transition-colors hover:bg-gray-50 cursor-pointer"
                onClick={() => isWaiting && !isFull && onJoin(room)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{room.roomType === 'private' ? '🔑' : '🔓'}</span>
                    <Badge variant={isWaiting ? 'info' : 'warning'}>
                      {isWaiting ? '대기' : '진행'}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{room.gameName}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                  <span className="truncate">{room.title}</span>
                  {room.timeLimitSeconds != null && (
                    <span className="ml-1.5">
                      <TimeLimitBadge seconds={room.timeLimitSeconds} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[100px] truncate">{room.hostNickname}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ProgressBar current={room.currentPlayers} max={room.maxPlayers} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {!isWaiting && (
                    <span className="text-xs">👁️ {room.spectatorCount}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {isWaiting && !isFull ? (
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onJoin(room); }}
                    >
                      입장
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); onSpectate(room); }}
                    >
                      관전
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
