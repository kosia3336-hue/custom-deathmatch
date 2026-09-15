'use client';

import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { PLAY_MODE_LABEL, type Room } from '@/shared/types';
import { cn, formatTimeLimit } from '@/lib/utils';
import { rankedRoomMatchup } from '@/lib/rankedRoomTitle';

/** 방 정보 한 줄 — 값이 없으면 줄째 뺀다. */
export function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-cdm-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-cdm-fg">{value}</dd>
    </div>
  );
}

/**
 * 방 정보 시트 — 대기실과 인게임의 'i' 가 같은 판을 연다.
 * 인게임에서 쓰던 모양(정보 줄 + 참여자 목록 + 신고)을 기준으로 삼았다.
 * 화면마다 다른 것은 슬롯으로 받는다: extraRows(인게임 '진행된 시간'), footer(대기실 방장 '설정 변경').
 */
export default function RoomInfoSheet({
  open,
  onClose,
  room,
  myId,
  extraRows,
  footer,
  onReport,
}: {
  open: boolean;
  onClose: () => void;
  room: Room | null | undefined;
  myId: string | null | undefined;
  extraRows?: ReactNode;
  footer?: ReactNode;
  onReport?: (target: { memberId: string; nickname: string }) => void;
}) {
  const people = [
    ...(room?.players ?? []).map((p) => ({ p, spectator: false })),
    ...(room?.spectators ?? []).map((p) => ({ p, spectator: true })),
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="방 정보">
      <dl className="divide-y divide-cdm-border text-sm">
        <InfoRow
          label="방 제목"
          value={room ? (room.isRanked ? rankedRoomMatchup(room, myId) : room.title) : undefined}
        />
        <InfoRow label="게임" value={room?.gameName} />
        <InfoRow label="플레이 모드" value={room ? PLAY_MODE_LABEL[room.playMode] : undefined} />
        <InfoRow label="랭크" value={room ? (room.isRanked === true ? '랭크 게임' : '일반 게임') : undefined} />
        <InfoRow label="방 유형" value={room ? (room.roomType === 'private' ? '비밀방' : '공개방') : undefined} />
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

      <h3 className="mt-4 mb-3 text-sm font-semibold">
        참여자 목록
        {room && (
          <span className="ml-1.5 font-normal text-cdm-fg-muted tabular-nums">
            {room.players.length}/{room.maxPlayers}
          </span>
        )}
      </h3>
      <ul className="space-y-2">
        {people.map(({ p, spectator }) => (
          <li
            key={p.id}
            className={cn('flex items-center gap-2 text-sm', spectator ? 'text-cdm-fg-muted' : 'text-cdm-fg')}
          >
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', spectator ? 'bg-cdm-fg-subtle' : 'bg-cdm-primary')}
            />
            <span className="min-w-0 flex-1 truncate">
              {p.nickname}
              {p.id === myId ? ' (나)' : ''}
            </span>
            {spectator && <span className="text-xs">(관전)</span>}
            {onReport && p.memberId && p.id !== myId && (
              <button
                type="button"
                onClick={() => onReport({ memberId: p.memberId!, nickname: p.nickname })}
                className="text-xs text-cdm-fg-subtle hover:text-cdm-danger"
              >
                신고
              </button>
            )}
          </li>
        ))}
      </ul>

      {footer && <div className="mt-4">{footer}</div>}
    </BottomSheet>
  );
}
