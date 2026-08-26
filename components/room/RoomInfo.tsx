import Badge from '@/components/ui/Badge';
import type { Room } from '@/shared/types';
import { PLAY_MODE_LABEL } from '@/shared/types';
import { formatTimeLimit } from '@/lib/utils';

interface Props {
  room: Room;
}

export default function RoomInfo({ room }: Props) {
  return (
    <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-4">
      <h3 className="mb-3 text-sm font-bold text-cdm-fg">방 정보</h3>
      <div className="space-y-2 text-sm text-cdm-fg-muted">
        <div className="flex justify-between">
          <span>게임</span>
          <span className="font-medium text-cdm-fg">{room.gameName}</span>
        </div>
        <div className="flex justify-between">
          <span>모드</span>
          <Badge>
            {PLAY_MODE_LABEL[room.playMode]}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>방 유형</span>
          <span>{room.roomType === 'public' ? '공개' : '비밀'}</span>
        </div>
        <div className="flex justify-between">
          <span>인원</span>
          <span className="font-medium">{room.players.length}/{room.maxPlayers}</span>
        </div>
        <div className="flex justify-between">
          <span>시간제한</span>
          <span className="font-medium">
            {room.timeLimitSeconds != null
              ? `${formatTimeLimit(room.timeLimitSeconds)}`
              : '∞ 무제한'}
          </span>
        </div>
      </div>
    </div>
  );
}
