'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useDockGesture, type DockGestureOptions } from '@/hooks/useDockGesture';
import { createPortal } from 'react-dom';
import { clampFloating, type DockEdge, type DockState } from '@/lib/dockPanel';
import { cn } from '@/lib/utils';

/** 놓으면 붙을 가장자리를 비추는 보랏빛 선 */
const EDGE_LINE: Record<DockEdge, string> = {
  left: 'inset-y-0 left-0 w-[3px]',
  right: 'inset-y-0 right-0 w-[3px]',
  top: 'inset-x-0 top-0 h-[3px]',
  bottom: 'inset-x-0 bottom-0 h-[3px]',
};

export interface DockablePanelProps extends DockGestureOptions {
  /** 자리를 기억할 창 id (lib/dockPanel.ts) */
  id: string;
  title: string;
  /** 부모가 useDockState(id) 로 읽어 넘긴다 — 붙은 가장자리에 따라 본문 배치도 부모가 정한다 */
  dock: DockState;
  /** 떠 있을 때(그리고 끄는 동안)의 크기 */
  floatingSize: { width: number; height: number };
  /** 붙어 있을 때의 크기·표시 클래스(부모 배치에 맞춘다) */
  className?: string;
  /** 대기실 등에서 사용하는 선택적 헤더 요소. */
  headerActions?: ReactNode;
  headerTitle?: ReactNode;
  children: ReactNode;
}

/**
 * 끌어서 옮기는 창(공용 파츠).
 *
 * 머리를 잡고 끌면 창이 들려 포인터를 따라온다. 가장자리 가까이(SNAP_DISTANCE) 가면 그쪽에 보랏빛 선이
 * 비치고, 놓으면 붙는다(본문 배치는 부모가 dock 을 보고 비켜 준다). 그 밖에 놓으면 그 자리에 떠 있다.
 * 머리에 포커스를 두고 방향키로도 붙일 수 있다. 안내 문구는 두지 않는다(숨은 기능).
 *
 * 끄는 동안 위치는 React 상태가 아니라 transform 으로 프레임마다 옮긴다 — 창 안(채팅 목록 등)을
 * 매번 다시 그리지 않게. 포인터를 놓치거나(lostpointercapture) 창 밖으로 나가거나(blur) Esc 면 끌기를 끝낸다.
 */
export default function DockablePanel({
  id,
  title,
  dock,
  floatingSize,
  className,
  headerActions,
  headerTitle,
  resolveDockTarget,
  getInsertionGuide,
  onDockDrop,
  onReorder,
  children,
}: DockablePanelProps) {
  const { panelRef, handleRef, lifted, target, guide, placeholderSize, ...handlers } =
    useDockGesture({
      id,
      floatingSize,
      resolveDockTarget,
      getInsertionGuide,
      onDockDrop,
      onReorder,
    });

  const floating = dock.mode === 'floating';
  let style: CSSProperties | undefined;
  if (lifted) {
    style = {
      position: 'fixed',
      left: 0,
      top: 0,
      width: floatingSize.width,
      height: Math.min(floatingSize.height, window.innerHeight - 16),
      zIndex: 'var(--cdm-z-overlay)',
    };
  } else if (floating) {
    const height = Math.min(floatingSize.height, window.innerHeight - 16);
    const pos = clampFloating(
      dock.x,
      dock.y,
      floatingSize.width,
      height,
      window.innerWidth,
      window.innerHeight,
    );
    style = {
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      width: floatingSize.width,
      height,
      zIndex: 'var(--cdm-z-sticky)',
    };
  }

  return (
    <>
      {/* 붙어 있던 창을 들면 본문이 튀지 않게 자리를 잠시 비워 둔다 */}
      {lifted && !floating && (
        <div
          aria-hidden
          className={cn(className, 'invisible')}
          style={{
            width: placeholderSize?.width,
            height: placeholderSize?.height,
            flex: '0 0 auto',
          }}
        />
      )}

      <section
        ref={panelRef}
        aria-label={title}
        style={style}
        className={cn(
          'rounded-cdm-lg border-cdm-border bg-cdm-bg flex-col overflow-hidden border',
          (lifted || floating) && 'shadow-(--cdm-shadow-md)',
          lifted && 'border-cdm-primary/50',
          className,
        )}
      >
        <div
          ref={handleRef}
          role="button"
          tabIndex={0}
          aria-label={`${title} 창 — 끌어서 옮기거나 방향키로 가장자리에 붙입니다${onReorder ? '. Alt+위/아래로 순서를 바꿉니다' : ''}`}
          {...handlers}
          className={cn(
            'border-cdm-border focus-visible:outline-cdm-primary flex shrink-0 touch-none items-center border-b px-3 py-2 select-none focus-visible:outline-2',
            lifted ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          <span className="text-cdm-fg min-w-0 flex-1 truncate text-sm font-semibold">
            {headerTitle ?? title}
          </span>
          {headerActions}
        </div>
        {children}
      </section>

      {lifted &&
        target &&
        createPortal(
          <div
            aria-hidden
            data-dock-guide={guide ? 'insertion' : 'edge'}
            className={cn(
              'bg-cdm-primary pointer-events-none fixed z-(--cdm-z-overlay) rounded-full',
              !guide && EDGE_LINE[target],
            )}
            style={{
              ...guide,
              boxShadow: '0 0 16px 3px color-mix(in srgb, var(--cdm-primary) 55%, transparent)',
            }}
          />,
          document.body,
        )}
    </>
  );
}
