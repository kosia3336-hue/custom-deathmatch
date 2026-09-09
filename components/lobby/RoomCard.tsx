'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import RoomTitle from './RoomTitle';
import type { RoomSummary } from '@/shared/types';
import { displayGameName } from '@/lib/unreleasedGames';

interface Props {
  rooms: RoomSummary[];
  onJoin: (room: RoomSummary) => void;
  onSpectate: (room: RoomSummary) => void;
  /** true이면 입장 버튼 비활성화 (랭크 큐 대기 중) */
  queuing?: boolean;
  /** 출시 전 게임의 종목 이름을 그대로 보여줄지 (lib/unreleasedGames.ts) */
  isAdmin?: boolean;
}

export default function RoomCardList({
  rooms,
  onJoin,
  onSpectate,
  queuing = false,
  isAdmin = false,
}: Props) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rooms.map((room) => {
        const isWaiting = room.status === 'waiting';
        const isFull = room.currentPlayers >= room.maxPlayers;
        const isRanked = room.isRanked === true;
        const canJoin = isWaiting && !isFull && !isRanked;
        const joinBlocked = canJoin && queuing;

        return (
          <div
            key={room.id}
            className="rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-4 transition-all hover:border-cdm-border-strong hover:shadow-(--cdm-shadow-sm)"
            onClick={() => canJoin && onJoin(room)}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-cdm-fg">
                  {displayGameName(room.gameId, room.gameName, isAdmin)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={isWaiting ? 'info' : 'warning'}>
                  {isWaiting ? '대기' : '진행'}
                </Badge>
              </div>
            </div>
            <div className="mb-1 text-sm font-medium text-cdm-fg"><RoomTitle room={room} /></div>
            <p className="mb-3 text-xs text-cdm-fg-muted">방장: {room.isRanked ? '—' : room.hostNickname}</p>
            <div className="flex items-center justify-between">
              <ProgressBar current={room.currentPlayers} max={room.maxPlayers} className="flex-1 mr-3" />
              {canJoin ? (
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onJoin(room); }}
                  className={joinBlocked ? 'opacity-40 cursor-not-allowed' : undefined}
                >
                  입장
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {!isWaiting && <span className="min-w-6 text-center text-xs tabular-nums text-cdm-fg-muted">{room.spectatorCount}</span>}
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
