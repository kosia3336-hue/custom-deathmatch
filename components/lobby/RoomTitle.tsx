import { Icon } from '@/components/cdm/Icon';
import TimeLimitBadge from '@/components/ui/TimeLimitBadge';
import type { RoomSummary } from '@/shared/types';

/** 데스크톱 목록·모바일 카드가 같은 순서와 모양으로 방 속성을 표시한다. */
export default function RoomTitle({ room }: { room: RoomSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate" title={room.title}>{room.title}</span>
      <span className="inline-flex shrink-0 items-center gap-1">
        {room.roomType === 'private' && (
          <span aria-label="비밀방" title="비밀번호가 필요한 방" className="inline-flex items-center rounded-cdm-sm border border-cdm-highlight-soft bg-cdm-highlight-soft px-1.5 py-0.5 text-[10px] font-medium text-[#a16207]">
            <Icon name="key" size="sm" className="h-3.5 w-3.5" />
          </span>
        )}
        {room.timeLimitSeconds != null && <TimeLimitBadge seconds={room.timeLimitSeconds} />}
      </span>
    </div>
  );
}
