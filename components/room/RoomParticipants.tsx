'use client';

import type { Room } from '@/shared/types';
import { cn } from '@/lib/utils';

export type ParticipantReportTarget = { memberId: string; nickname: string };

/** 서버가 제공한 공개 닉네임만 사용한다. 플레이어와 관전자를 모두 표시한다. */
export default function RoomParticipants({
  room,
  myId,
  onReport,
}: {
  room: Room | null | undefined;
  myId: string | null | undefined;
  onReport?: (target: ParticipantReportTarget) => void;
}) {
  const people = [
    ...(room?.players ?? []).map((p) => ({ p, spectator: false })),
    ...(room?.spectators ?? []).map((p) => ({ p, spectator: true })),
  ];
  return (
    <>
      <h3 className="mb-3 text-sm font-semibold">
        참여자 목록
        {room && (
          <span className="text-cdm-fg-muted ml-1.5 font-normal tabular-nums">
            {room.players.length}/{room.maxPlayers}
          </span>
        )}
      </h3>
      <ul className="space-y-2">
        {people.map(({ p, spectator }) => (
          <li
            key={p.id}
            className={cn(
              'flex items-center gap-2 text-sm',
              spectator ? 'text-cdm-fg-muted' : 'text-cdm-fg',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                spectator ? 'bg-cdm-fg-subtle' : 'bg-cdm-primary',
              )}
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
                className="text-cdm-fg-subtle hover:text-cdm-danger text-xs"
              >
                신고
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
