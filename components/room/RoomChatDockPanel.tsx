'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { RoomChatTabs } from '@/components/room/ChatButton';
import { nearestDockEdge, setRoomChatDock, type RoomChatDock } from '@/lib/roomChatDock';
import { useRoomStore } from '@/stores/room';
import { cn } from '@/lib/utils';
import type { ChatScope } from '@/shared/types';

const EDGE_LABEL: Record<RoomChatDock, string> = {
  left: '왼쪽',
  right: '오른쪽',
  top: '위',
  bottom: '아래',
};

/** 끄는 동안 보여 줄 붙일 자리 표시 */
const EDGE_ZONE: Record<RoomChatDock, string> = {
  left: 'left-3 top-24 bottom-3 w-28',
  right: 'right-3 top-24 bottom-3 w-28',
  top: 'top-24 left-36 right-36 h-24',
  bottom: 'bottom-3 left-36 right-36 h-24',
};

const ARROW_TO_EDGE: Record<string, RoomChatDock> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};

/** 이만큼은 움직여야 끌기로 본다 — 머리를 누르기만 해도 자리가 바뀌지 않게 */
const DRAG_THRESHOLD = 8;
const GHOST_WIDTH = 320;

interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

/**
 * 대기실 채팅창(넓은 화면). 머리를 잡고 끌어 놓으면 가장 가까운 가장자리(상·하·좌·우)에 붙고
 * 본문은 그만큼 비켜난다. 붙인 자리는 기기마다 기억한다(lib/roomChatDock.ts). 방향키로도 옮길 수 있다.
 * 좁은 화면에서는 부모가 숨기고(hidden md:flex) 헤더의 채팅 버튼 → 시트를 쓴다.
 */
export default function RoomChatDockPanel({
  scope,
  dock,
  className,
}: {
  scope: ChatScope;
  dock: RoomChatDock;
  className?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // 펴 둔 채팅은 늘 보고 있으므로 새 메시지는 바로 읽은 것으로. 좁은 화면(숨김)에서는 헤더 배지를 살려 둔다.
  const messagesLen = useRoomStore((s) => s.messages.length);
  const clearChatUnread = useRoomStore((s) => s.clearChatUnread);
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) clearChatUnread();
  }, [messagesLen, clearChatUnread]);

  const movedEnough = (d: DragState, x: number, y: number) =>
    Math.hypot(x - d.startX, y - d.startY) > DRAG_THRESHOLD;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: Math.min(e.clientX - rect.left, GHOST_WIDTH - 24),
      offsetY: e.clientY - rect.top,
    });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
  };

  const finishDrag = (e: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!drag) return;
    const moved = movedEnough(drag, e.clientX, e.clientY);
    setDrag(null);
    if (commit && moved) {
      setRoomChatDock(nearestDockEdge(e.clientX, e.clientY, window.innerWidth, window.innerHeight));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const edge = ARROW_TO_EDGE[e.key];
    if (!edge) return;
    e.preventDefault();
    setRoomChatDock(edge);
  };

  const target =
    drag && movedEnough(drag, drag.x, drag.y)
      ? nearestDockEdge(drag.x, drag.y, window.innerWidth, window.innerHeight)
      : null;

  return (
    <>
      <section
        ref={panelRef}
        aria-label="채팅"
        className={cn(
          'flex-col overflow-hidden rounded-cdm-lg border border-cdm-border bg-cdm-bg transition-opacity',
          target && 'opacity-50',
          className,
        )}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`채팅창 옮기기 — 지금 ${EDGE_LABEL[dock]}. 끌어서 놓거나 방향키로 붙일 자리를 고릅니다`}
          title="끌어서 위·아래·왼쪽·오른쪽에 붙이기"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finishDrag(e, true)}
          onPointerCancel={(e) => finishDrag(e, false)}
          onKeyDown={onKeyDown}
          className="flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-cdm-border px-3 py-2 select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-cdm-primary"
        >
          <svg className="h-4 w-4 text-cdm-fg-subtle" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
          <span className="flex-1 text-sm font-semibold text-cdm-fg">채팅</span>
          <span className="text-[11px] text-cdm-fg-subtle">끌어서 옮기기</span>
        </div>
        <RoomChatTabs scope={scope} active />
      </section>

      {drag && target && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-(--cdm-z-overlay)">
          {(['left', 'right', 'top', 'bottom'] as const).map((edge) => (
            <div
              key={edge}
              className={cn(
                'absolute flex items-center justify-center rounded-cdm-lg border-2 border-dashed text-xs font-semibold transition-colors',
                EDGE_ZONE[edge],
                edge === target
                  ? 'border-cdm-primary bg-cdm-primary-soft/80 text-cdm-primary'
                  : 'border-cdm-border-strong bg-cdm-bg/40 text-cdm-fg-muted',
              )}
            >
              {EDGE_LABEL[edge]}에 붙이기
            </div>
          ))}
          <div
            className="absolute flex h-[220px] flex-col overflow-hidden rounded-cdm-lg border border-cdm-primary bg-cdm-bg shadow-(--cdm-shadow-md)"
            style={{ width: GHOST_WIDTH, left: drag.x - drag.offsetX, top: drag.y - drag.offsetY }}
          >
            <div className="border-b border-cdm-border px-3 py-2 text-sm font-semibold text-cdm-fg">채팅</div>
            <div className="flex flex-1 items-center justify-center text-xs text-cdm-fg-muted">
              {EDGE_LABEL[target]}에 붙입니다
            </div>
          </div>
        </div>
      )}
    </>
  );
}
