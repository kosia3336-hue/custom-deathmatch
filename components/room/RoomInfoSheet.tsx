'use client';

import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { PLAY_MODE_LABEL, type Room } from '@/shared/types';
import { formatTimeLimit } from '@/lib/utils';
import { rankedRoomMatchup } from '@/lib/rankedRoomTitle';
import RoomParticipants from './RoomParticipants';
import RankedRoomBadge from './RankedRoomBadge';

/** 방 정보 한 줄 — 값이 없으면 줄째 뺀다. */
export function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="text-cdm-fg-muted shrink-0">{label}</dt>
      <dd className="text-cdm-fg min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}

/**
 * 공용 방 설정 정보. 대기실은 참여자 목록도 표시한다.
 * 인게임 참여자 목록은 채팅 헤더로 이동했으므로 showParticipants=false를 사용한다.
 * extraRows는 인게임의 경과 시간, footer는 대기실 방장의 설정 변경을 담는다.
 */
export default function RoomInfoSheet({
  open,
  onClose,
  room,
  myId,
  extraRows,
  footer,
  onReport,
  showParticipants = true,
}: {
  open: boolean;
  onClose: () => void;
  room: Room | null | undefined;
  myId: string | null | undefined;
  showParticipants?: boolean;
  extraRows?: ReactNode;
  footer?: ReactNode;
  onReport?: (target: { memberId: string; nickname: string }) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="방 정보">
      <dl className="divide-cdm-border divide-y text-sm">
        <InfoRow
          label="방 제목"
          value={
            room ? (
              room.isRanked ? (
                <span className="inline-flex items-center gap-1.5">
                  <RankedRoomBadge />
                  {rankedRoomMatchup(room, myId)}
                </span>
              ) : (
                room.title
              )
            ) : undefined
          }
        />
        <InfoRow label="게임" value={room?.gameName} />
        <InfoRow label="플레이 모드" value={room ? PLAY_MODE_LABEL[room.playMode] : undefined} />
        <InfoRow
          label="랭크"
          value={room ? (room.isRanked === true ? '랭크 게임' : '일반 게임') : undefined}
        />
        <InfoRow
          label="방 유형"
          value={room ? (room.roomType === 'private' ? '비밀방' : '공개방') : undefined}
        />
        <InfoRow
          label="시간 제한"
          value={
            room
              ? room.timeLimitSeconds != null
                ? formatTimeLimit(room.timeLimitSeconds)
                : '무제한'
              : undefined
          }
        />
        {extraRows}
      </dl>

      {showParticipants && (
        <div className="mt-4">
          <RoomParticipants room={room} myId={myId} onReport={onReport} />
        </div>
      )}

      {footer && <div className="mt-4">{footer}</div>}
    </BottomSheet>
  );
}
