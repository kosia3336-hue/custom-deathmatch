'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  clampFloating,
  resolveDrop,
  setDockState,
  type DockEdge,
  type DockState,
} from '@/lib/dockPanel';
import { cn } from '@/lib/utils';

/** 이만큼은 움직여야 끌기로 본다 — 머리를 누르기만 해서는 창이 들리지 않게 */
const DRAG_THRESHOLD = 6;

const ARROW_TO_EDGE: Record<string, DockEdge> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};

/** 놓으면 붙을 가장자리를 비추는 보랏빛 선 */
const EDGE_LINE: Record<DockEdge, string> = {
  left: 'inset-y-0 left-0 w-[3px]',
  right: 'inset-y-0 right-0 w-[3px]',
  top: 'inset-x-0 top-0 h-[3px]',
  bottom: 'inset-x-0 bottom-0 h-[3px]',
};

interface DragData {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  lifted: boolean;
  frame: number | null;
}

export interface DockablePanelProps {
  /** 자리를 기억할 창 id (lib/dockPanel.ts) */
  id: string;
  title: string;
  /** 부모가 useDockState(id) 로 읽어 넘긴다 — 붙은 가장자리에 따라 본문 배치도 부모가 정한다 */
  dock: DockState;
  /** 떠 있을 때(그리고 끄는 동안)의 크기 */
  floatingSize: { width: number; height: number };
  /** 붙어 있을 때의 크기·표시 클래스(부모 배치에 맞춘다) */
  className?: string;
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
  children,
}: DockablePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragData | null>(null);
  const [lifted, setLifted] = useState(false);
  const [target, setTarget] = useState<DockEdge | null>(null);

  const applyPosition = useCallback(() => {
    const d = dragRef.current;
    const el = panelRef.current;
    if (!d || !el) return;
    d.frame = null;
    el.style.transform = `translate3d(${d.x - d.offsetX}px, ${d.y - d.offsetY}px, 0)`;
  }, []);

  const endDrag = useCallback(
    (commit: boolean) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.frame != null) cancelAnimationFrame(d.frame);
      if (panelRef.current) panelRef.current.style.transform = '';
      try {
        handleRef.current?.releasePointerCapture(d.pointerId);
      } catch {
        // 이미 풀린 경우
      }
      setLifted(false);
      setTarget(null);
      if (!commit || !d.lifted) return;

      const edge = resolveDrop(d.x, d.y, window.innerWidth, window.innerHeight);
      if (edge) {
        setDockState(id, { mode: 'docked', edge });
      } else {
        setDockState(id, {
          mode: 'floating',
          ...clampFloating(
            d.x - d.offsetX,
            d.y - d.offsetY,
            floatingSize.width,
            floatingSize.height,
            window.innerWidth,
            window.innerHeight,
          ),
        });
      }
    },
    [id, floatingSize.width, floatingSize.height],
  );

  // 끄는 중 창 밖으로 나가거나 Esc 를 누르면 제자리로
  useEffect(() => {
    if (!lifted) return;
    const cancel = () => endDrag(false);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [lifted, endDrag]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !panelRef.current) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // 끄는 동안 글자 선택이 번지지 않게
    const rect = panelRef.current.getBoundingClientRect();
    try {
      // 창 밖으로 포인터가 나가도 움직임·놓기를 계속 받는다. 캡처할 수 없는 포인터면(드문 경우) 그냥 진행한다.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 캡처 실패 — 머리 위에서의 이벤트만으로 끌기를 처리한다
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      // 창이 떠 있는 크기로 바뀌어도 포인터가 머리 위에 남도록
      offsetX: Math.min(Math.max(0, e.clientX - rect.left), floatingSize.width - 24),
      offsetY: Math.min(Math.max(0, e.clientY - rect.top), 28),
      lifted: false,
      frame: null,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.lifted) {
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < DRAG_THRESHOLD) return;
      d.lifted = true;
      applyPosition();
      setLifted(true);
    }
    const next = resolveDrop(d.x, d.y, window.innerWidth, window.innerHeight);
    setTarget((prev) => (prev === next ? prev : next));
    if (d.frame == null) d.frame = requestAnimationFrame(applyPosition);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const edge = ARROW_TO_EDGE[e.key];
    if (!edge) return;
    e.preventDefault();
    setDockState(id, { mode: 'docked', edge });
  };

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
    const pos = clampFloating(dock.x, dock.y, floatingSize.width, height, window.innerWidth, window.innerHeight);
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
      {lifted && !floating && <div aria-hidden className={cn(className, 'invisible')} />}

      <section
        ref={panelRef}
        aria-label={title}
        style={style}
        className={cn(
          'flex-col overflow-hidden rounded-cdm-lg border border-cdm-border bg-cdm-bg',
          (lifted || floating) && 'shadow-(--cdm-shadow-md)',
          lifted && 'border-cdm-primary/50',
          className,
        )}
      >
        <div
          ref={handleRef}
          role="button"
          tabIndex={0}
          aria-label={`${title} 창 — 끌어서 옮기거나 방향키로 가장자리에 붙입니다`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onLostPointerCapture={() => endDrag(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'flex shrink-0 touch-none items-center border-b border-cdm-border px-3 py-2 select-none focus-visible:outline-2 focus-visible:outline-cdm-primary',
            lifted ? 'cursor-grabbing' : 'cursor-grab',
          )}
        >
          <span className="text-sm font-semibold text-cdm-fg">{title}</span>
        </div>
        {children}
      </section>

      {lifted && target && (
        <div
          aria-hidden
          className={cn('pointer-events-none fixed z-(--cdm-z-overlay) rounded-full bg-cdm-primary', EDGE_LINE[target])}
          style={{ boxShadow: '0 0 16px 3px color-mix(in srgb, var(--cdm-primary) 55%, transparent)' }}
        />
      )}
    </>
  );
}
