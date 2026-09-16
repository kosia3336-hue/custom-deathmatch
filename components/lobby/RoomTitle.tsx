import { Icon } from '@/components/cdm/Icon';
import TimeLimitBadge from '@/components/ui/TimeLimitBadge';
import RankedRoomBadge from '@/components/room/RankedRoomBadge';
import { rankedLobbyMatchup } from '@/lib/rankedRoomTitle';
import type { RoomSummary } from '@/shared/types';

/** 데스크톱 목록·모바일 카드가 같은 순서와 모양으로 방 속성을 표시한다. */
export default function RoomTitle({ room }: { room: RoomSummary }) {
  // 랭크 방은 '[랭크] 게임명' 대신 앞에 '랭크' 배지 + '???[티어] VS ???[티어]'
  const title = room.isRanked ? rankedLobbyMatchup(room) : room.title;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {room.isRanked && <RankedRoomBadge />}
      <span className="min-w-0 truncate" title={title}>{title}</span>
      <span className="inline-flex shrink-0 items-stretch gap-1">
        {room.roomType === 'private' && (
          // 자물쇠는 타이머 배지와 같은 그림 크기(h-3), 배지 높이도 나란히 맞춘다
          <span aria-label="비밀방" title="비밀번호가 필요한 방" className="inline-flex items-center rounded-cdm-sm border border-cdm-highlight-soft bg-cdm-highlight-soft px-1.5 py-0.5 text-[10px] font-medium text-[#a16207]">
            <Icon name="lock" size="sm" className="h-3 w-3" />
          </span>
        )}
        {room.timeLimitSeconds != null && <TimeLimitBadge seconds={room.timeLimitSeconds} />}
      </span>
    </div>
  );
}
