'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import RoomTitle from './RoomTitle';
import type { RoomSummary } from '@/shared/types';
import { displayGameName } from '@/lib/unreleasedGames';
import { GUILD_WAR_ROOM_ID } from '@shared/types/ring-the-bell';

interface Props {
  rooms: RoomSummary[];
  onJoin: (room: RoomSummary) => void;
  onSpectate: (room: RoomSummary) => void;
  /** true이면 입장 버튼 비활성화 (랭크 큐 대기 중) */
  queuing?: boolean;
  /** 출시 전 게임의 종목 이름을 그대로 보여줄지 (lib/unreleasedGames.ts) */
  isAdmin?: boolean;
}

export default function RoomTable({
  rooms,
  onJoin,
  onSpectate,
  queuing = false,
  isAdmin = false,
}: Props) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cdm-border text-left text-xs font-medium uppercase tracking-wider text-cdm-fg-muted">
            <th className="px-4 py-3 w-28 whitespace-nowrap">상태</th>
            <th className="px-4 py-3 whitespace-nowrap">게임</th>
            <th className="px-4 py-3">방 제목</th>
            <th className="px-4 py-3 whitespace-nowrap">방장</th>
            <th className="px-4 py-3 w-36 whitespace-nowrap">인원</th>
            <th className="px-4 py-3 w-16 whitespace-nowrap text-center">관전</th>
            <th className="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const isWaiting = room.status === 'waiting';
            const isFull = room.currentPlayers >= room.maxPlayers;
            const isRanked = room.isRanked === true;
            // 길드전은 상시 playing 인 시스템 룸이라 waiting 조건을 타지 않는다.
            const isGuildWar = room.id === GUILD_WAR_ROOM_ID;
            const canJoin = isGuildWar ? !isFull : isWaiting && !isFull && !isRanked;
            const joinBlocked = canJoin && queuing;

            return (
              <tr
                key={room.id}
                className="border-b border-cdm-border transition-colors hover:bg-cdm-bg-elev-1 cursor-pointer"
                onClick={() => canJoin && onJoin(room)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={isWaiting || isGuildWar ? 'info' : 'warning'}>
                      {isGuildWar ? '상시' : isWaiting ? '대기' : '진행'}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-cdm-fg whitespace-nowrap">
                  {displayGameName(room.gameId, room.gameName, isAdmin)}
                </td>
                <td className="px-4 py-3 text-cdm-fg max-w-[180px]">
                  <RoomTitle room={room} />
                </td>
                <td className="px-4 py-3 text-cdm-fg-muted whitespace-nowrap max-w-[100px] truncate">{room.isRanked || !room.hostNickname ? '—' : room.hostNickname}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ProgressBar current={room.currentPlayers} max={room.maxPlayers} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center tabular-nums text-cdm-fg-muted">
                  {(!isWaiting || isGuildWar) && (
                    <span className="text-xs">{room.spectatorCount}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  {canJoin ? (
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onJoin(room); }}
                      className={joinBlocked ? 'opacity-40 cursor-not-allowed' : undefined}
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
