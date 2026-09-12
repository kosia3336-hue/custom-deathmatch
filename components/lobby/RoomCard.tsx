'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { ChevronIcon } from '@/components/room-modal/RoomModalKit';
import RoomTitle from './RoomTitle';
import type { RoomSummary } from '@/shared/types';
import { displayGameName, isUnreleasedGame } from '@/lib/unreleasedGames';
import { cn } from '@/lib/utils';

interface Props {
  rooms: RoomSummary[];
  onJoin: (room: RoomSummary) => void;
  onSpectate: (room: RoomSummary) => void;
  /** true이면 입장 버튼 비활성화 (랭크 큐 대기 중) */
  queuing?: boolean;
  /** 출시 전 게임의 종목 이름을 그대로 보여줄지 (lib/unreleasedGames.ts) */
  isAdmin?: boolean;
}

/**
 * 게임 대표 이미지. 배경으로 깔아 파일이 없는 게임도 깨진 아이콘 없이 비어 보인다.
 * 출시 전 게임은 이름을 가리는 것과 같은 이유로 그림도 싣지 않는다.
 */
function GameThumb({ gameId, isAdmin, className }: { gameId: string; isAdmin: boolean; className?: string }) {
  const hidden = !isAdmin && isUnreleasedGame(gameId);
  return (
    <span
      aria-hidden
      className={cn('block flex-none overflow-hidden rounded-cdm-md bg-cdm-ink bg-cover bg-center', className)}
      style={hidden ? undefined : { backgroundImage: `url(/games/${gameId}.webp)` }}
    />
  );
}

/**
 * 모바일 방 목록 (앱 재설계안 1b).
 *
 * 들어갈 수 있는 대기방을 앞에 카드로 두고, 진행 중인 방은 한 줄로 접는다.
 * 진행 중인 방은 관전만 가능해서 목록 앞자리를 차지하면 입장할 방이 밀려난다.
 * 대기방이 하나도 없으면 접을 이유가 없으므로 처음부터 펼친다.
 */
export default function RoomCardList({
  rooms,
  onJoin,
  onSpectate,
  queuing = false,
  isAdmin = false,
}: Props) {
  const [playingOpen, setPlayingOpen] = useState(false);

  const waiting = rooms.filter((r) => r.status === 'waiting');
  const playing = rooms.filter((r) => r.status !== 'waiting');
  const showPlaying = playingOpen || waiting.length === 0;

  const card = (room: RoomSummary) => (
    <RoomCardItem
      key={room.id}
      room={room}
      queuing={queuing}
      isAdmin={isAdmin}
      onJoin={onJoin}
      onSpectate={onSpectate}
    />
  );

  const first = playing[0];
  const firstName = first ? displayGameName(first.gameId, first.gameName, isAdmin) : '';

  return (
    <div className="flex flex-col gap-2.5 md:hidden">
      {waiting.map(card)}

      {playing.length > 0 && waiting.length > 0 && (
        <button
          type="button"
          onClick={() => setPlayingOpen((v) => !v)}
          aria-expanded={playingOpen}
          className={cn(
            'flex items-center gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-2.5 text-left transition-opacity',
            !playingOpen && 'opacity-70',
          )}
        >
          <GameThumb gameId={first.gameId} isAdmin={isAdmin} className="h-8.5 w-19 opacity-60" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-cdm-fg-muted">
            {playingOpen
              ? '진행 중인 방 접기'
              : playing.length === 1
                ? `${firstName} · 진행 중`
                : `${firstName} 외 ${playing.length - 1}개 · 진행 중`}
          </span>
          <ChevronIcon open={playingOpen} />
        </button>
      )}

      {showPlaying && playing.map(card)}
    </div>
  );
}

function RoomCardItem({
  room,
  onJoin,
  onSpectate,
  queuing,
  isAdmin,
}: {
  room: RoomSummary;
  onJoin: (room: RoomSummary) => void;
  onSpectate: (room: RoomSummary) => void;
  queuing: boolean;
  isAdmin: boolean;
}) {
  const isWaiting = room.status === 'waiting';
  const isFull = room.currentPlayers >= room.maxPlayers;
  const isRanked = room.isRanked === true;
  const canJoin = isWaiting && !isFull && !isRanked;
  const joinBlocked = canJoin && queuing;

  return (
    <div
      className="flex gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-2.5 transition-all hover:border-cdm-border-strong hover:shadow-(--cdm-shadow-sm)"
      onClick={() => canJoin && onJoin(room)}
    >
      <GameThumb gameId={room.gameId} isAdmin={isAdmin} className="size-19" />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="truncate text-[11px] font-bold text-cdm-primary">
              {displayGameName(room.gameId, room.gameName, isAdmin)}
            </span>
            {!isWaiting && <Badge variant="warning">진행</Badge>}
          </div>
          <div className="text-[15px] font-bold tracking-tight text-cdm-fg">
            <RoomTitle room={room} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-cdm-fg-muted">
            방장 {room.isRanked ? '—' : room.hostNickname}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-cdm-fg-muted tabular-nums">
            {room.currentPlayers}/{room.maxPlayers}
            {!isWaiting && room.spectatorCount > 0 && (
              <span className="ml-2 font-medium">관전 {room.spectatorCount}</span>
            )}
          </span>
          {canJoin ? (
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); onJoin(room); }}
              className={joinBlocked ? 'opacity-40 cursor-not-allowed' : undefined}
            >
              입장
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onSpectate(room); }}>
              관전
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
