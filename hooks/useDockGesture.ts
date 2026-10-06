import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { clampFloating, resolveDrop, setDockState, type DockEdge } from '@/lib/dockPanel';
import type { InsertionGuide } from '@/lib/gameToolDrop';

export interface DockGestureOptions {
  id: string;
  floatingSize: { width: number; height: number };
  resolveDockTarget?: (x: number, y: number) => DockEdge | null;
  getInsertionGuide?: (edge: DockEdge, x: number, y: number) => InsertionGuide | null;
  onDockDrop?: (edge: DockEdge, x: number, y: number) => void;
  onReorder?: (direction: -1 | 1) => void;
}

/** 이만큼은 움직여야 끌기로 본다 — 머리를 누르기만 해서는 창이 들리지 않게 */
const DRAG_THRESHOLD = 6;

const ARROW_TO_EDGE: Record<string, DockEdge> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};

interface DragData {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  lifted: boolean;
  frame: number | null;
}

/** 포인터 수명과 키보드 도킹. 내용/헤더 렌더링은 담당하지 않는다. */
export function useDockGesture({
  id,
  floatingSize,
  resolveDockTarget,
  getInsertionGuide,
  onDockDrop,
  onReorder,
}: DockGestureOptions) {
  const panelRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragData | null>(null);
  const [lifted, setLifted] = useState(false);
  const [placeholderSize, setPlaceholderSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [target, setTarget] = useState<DockEdge | null>(null);
  const [guide, setGuide] = useState<InsertionGuide | null>(null);

  const updateGuide = useCallback(
    (x: number, y: number) => {
      const next = resolveDockTarget
        ? resolveDockTarget(x, y)
        : resolveDrop(x, y, window.innerWidth, window.innerHeight);
      const nextGuide = next ? (getInsertionGuide?.(next, x, y) ?? null) : null;
      setTarget((prev) => (prev === next ? prev : next));
      setGuide((prev) =>
        prev?.left === nextGuide?.left &&
        prev?.top === nextGuide?.top &&
        prev?.width === nextGuide?.width &&
        prev?.height === nextGuide?.height
          ? prev
          : nextGuide,
      );
    },
    [resolveDockTarget, getInsertionGuide],
  );

  const applyPosition = useCallback(() => {
    const d = dragRef.current;
    const el = panelRef.current;
    if (!d || !el) return;
    d.frame = null;
    el.style.transform = `translate3d(${d.x - d.offsetX}px, ${d.y - d.offsetY}px, 0)`;
    updateGuide(d.x, d.y);
  }, [updateGuide]);

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
      setGuide(null);
      if (!commit || !d.lifted) return;

      const edge = resolveDockTarget
        ? resolveDockTarget(d.x, d.y)
        : resolveDrop(d.x, d.y, window.innerWidth, window.innerHeight);
      if (edge) {
        onDockDrop?.(edge, d.x, d.y);
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
    [id, floatingSize.width, floatingSize.height, resolveDockTarget, onDockDrop],
  );

  // 끄는 중 창 밖으로 나가거나 Esc 를 누르면 제자리로
  useEffect(() => {
    if (!lifted) return;
    const cancel = () => endDrag(false);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    const refresh = () => {
      const d = dragRef.current;
      if (d) updateGuide(d.x, d.y);
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, [lifted, endDrag, updateGuide]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select, input, summary')) return;
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
      width: rect.width,
      height: rect.height,
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
      setPlaceholderSize({ width: d.width, height: d.height });
      setLifted(true);
    }
    if (d.frame == null) d.frame = requestAnimationFrame(applyPosition);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (onReorder && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      onReorder(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    const edge = ARROW_TO_EDGE[e.key];
    if (!edge) return;
    e.preventDefault();
    setDockState(id, { mode: 'docked', edge });
  };

  useEffect(() => {
    const handle = handleRef.current;
    return () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.frame != null) cancelAnimationFrame(d.frame);
      if (d) {
        try {
          handle?.releasePointerCapture(d.pointerId);
        } catch {
          /* 캡처가 이미 종료됨 */
        }
      }
    };
  }, []);
  return {
    panelRef,
    handleRef,
    lifted,
    target,
    guide,
    placeholderSize,
    onPointerDown,
    onPointerMove,
    onPointerUp: () => endDrag(true),
    onPointerCancel: () => endDrag(false),
    onLostPointerCapture: () => endDrag(false),
    onKeyDown,
  };
}
