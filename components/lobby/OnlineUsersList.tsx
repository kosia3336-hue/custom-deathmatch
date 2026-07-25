'use client';

import { cn } from '@/lib/utils';
import { useOnlineUsersStore } from '@/stores/onlineUsers';
import { useNicknameStore } from '@/stores/nickname';
import type { OnlineUser } from '@/shared/types/events';

/** 상태별 컬러 점 (이모지 대체) */
const STATUS_DOT: Record<OnlineUser['status'], string> = {
  playing: 'bg-cdm-success',
  waiting: 'bg-cdm-highlight',
  lobby: 'bg-cdm-bg-elev-3',
};

function StatusDot({ status }: { status: OnlineUser['status'] }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />;
}

function UserRow({ user, isMe }: { user: OnlineUser; isMe: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-cdm-bg-elev-2 transition-colors">
      <span className={cn('min-w-0 truncate text-sm text-cdm-fg', isMe && 'font-bold')}>
        {user.nickname}
        {isMe && <span className="ml-1 text-cdm-fg-muted font-normal">(나)</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-cdm-fg-muted">
        <StatusDot status={user.status} />
      </span>
    </div>
  );
}

function OnlineUsersSummary({ users }: { users: OnlineUser[] }) {
  const playing = users.filter((u) => u.status === 'playing').length;
  const waiting = users.filter((u) => u.status === 'waiting').length;
  const lobby = users.filter((u) => u.status === 'lobby').length;

  return (
    <div className="flex items-center justify-around border-b border-cdm-border bg-cdm-bg-elev-1 px-2 py-3">
      <div className={cn('flex flex-col items-center gap-0.5', playing === 0 && 'opacity-40')}>
        <span className="flex items-center gap-1 text-sm"><StatusDot status="playing" /> {playing}</span>
        <span className="text-[10px] text-cdm-fg-muted">게임 중</span>
      </div>
      <span className="text-cdm-border">·</span>
      <div className={cn('flex flex-col items-center gap-0.5', waiting === 0 && 'opacity-40')}>
        <span className="flex items-center gap-1 text-sm"><StatusDot status="waiting" /> {waiting}</span>
        <span className="text-[10px] text-cdm-fg-muted">대기실</span>
      </div>
      <span className="text-cdm-border">·</span>
      <div className={cn('flex flex-col items-center gap-0.5', lobby === 0 && 'opacity-40')}>
        <span className="flex items-center gap-1 text-sm"><StatusDot status="lobby" /> {lobby}</span>
        <span className="text-[10px] text-cdm-fg-muted">로비</span>
      </div>
    </div>
  );
}

/**
 * 접속자 현황 탭 본문 (요약 + 목록).
 * 전역 useOnlineUsersStore 를 구독하므로 어느 페이지(로비/방/게임 중)에서 열어도 동일하게 동작한다.
 */
export function OnlineUsersList() {
  const users = useOnlineUsersStore((s) => s.users);
  const myNickname = useNicknameStore((s) => s.nickname);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <OnlineUsersSummary users={users} />
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <p className="py-12 text-center text-sm text-cdm-fg-muted">접속자 없음</p>
        ) : (
          users.map((user) => (
            <UserRow key={user.memberId} user={user} isMe={user.nickname === myNickname} />
          ))
        )}
      </div>
    </div>
  );
}
