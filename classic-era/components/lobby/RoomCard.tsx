'use client';

import Badge from '@/classic-era/components/ui/Badge';
import Button from '@/classic-era/components/ui/Button';
import ProgressBar from '@/classic-era/components/ui/ProgressBar';
import TimeLimitBadge from '@/classic-era/components/ui/TimeLimitBadge';
import type { RoomSummary } from '@/classic-era/shared/types';

interface Props {
  rooms: RoomSummary[];
  onJoin: (room: RoomSummary) => void;
  onSpectate: (room: RoomSummary) => void;
}

export default function RoomCardList({ rooms, onJoin, onSpectate }: Props) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rooms.map((room) => {
        const isWaiting = room.status === 'waiting';
        const isFull = room.currentPlayers >= room.maxPlayers;

        return (
          <div
            key={room.id}
            className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            onClick={() => isWaiting && !isFull && onJoin(room)}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{room.roomType === 'private' ? '🔒' : '🔓'}</span>
                <span className="font-medium text-gray-900">{room.gameName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {room.timeLimitSeconds != null && (
                  <TimeLimitBadge seconds={room.timeLimitSeconds} />
                )}
                <Badge variant={isWaiting ? 'info' : 'warning'}>
                  {isWaiting ? '대기' : '진행'}
                </Badge>
              </div>
            </div>
            <p className="mb-1 text-sm font-medium text-gray-800 truncate">{room.title}</p>
            <p className="mb-3 text-xs text-gray-500">방장: {room.hostNickname}</p>
            <div className="flex items-center justify-between">
              <ProgressBar current={room.currentPlayers} max={room.maxPlayers} className="flex-1 mr-3" />
              {isWaiting && !isFull ? (
                <Button size="sm" onClick={(e) => { e.stopPropagation(); onJoin(room); }}>
                  입장
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {!isWaiting && <span className="text-xs text-gray-500">👁️ {room.spectatorCount}</span>}
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onSpectate(room); }}>
                    관전
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
