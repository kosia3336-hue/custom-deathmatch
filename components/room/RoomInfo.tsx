import Badge from '@/components/ui/Badge';
import type { Room } from '@/shared/types';

interface Props {
  room: Room;
}

export default function RoomInfo({ room }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-700">방 정보</h3>
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>게임</span>
          <span className="font-medium text-gray-900">{room.gameName}</span>
        </div>
        <div className="flex justify-between">
          <span>모드</span>
          <Badge>
            {room.playMode === 'multi' ? '멀티' : room.playMode === 'com' ? 'COM' : '솔로'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>방 유형</span>
          <span>{room.roomType === 'public' ? '🔓 공개' : '🔒 비밀'}</span>
        </div>
        <div className="flex justify-between">
          <span>인원</span>
          <span className="font-medium">{room.players.length}/{room.maxPlayers}</span>
        </div>
      </div>
    </div>
  );
}
