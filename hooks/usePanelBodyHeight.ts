'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** PC 창 높이는 위치/순서와 별도로 보관한다. 드래그가 끝날 때만 저장한다. */
export function usePanelBodyHeight(id: string, initial: number, minimum = 220, maximum = 720) {
  const key = `cdm:panel-body-height:${id}`;
  const clamp = (value: number) => Math.round(Math.max(minimum, Math.min(maximum, value)));
  const [height, setHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      const value = saved === null ? initial : Number(saved);
      return clamp(Number.isFinite(value) ? value : initial);
    } catch {
      return clamp(initial);
    }
  });
  const current = useRef(height);
  const drag = useRef<{ pointer: number; y: number; height: number } | null>(null);
  const update = (value: number) => {
    current.current = clamp(value);
    setHeight(current.current);
  };
  const save = () => {
    try {
      localStorage.setItem(key, String(current.current));
    } catch {
      // 저장이 차단되어도 이번 화면에서 높이 조절은 사용할 수 있다.
    }
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    save();
  };
  return {
    height,
    minimum,
    maximum,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current = { pointer: event.pointerId, y: event.clientY, height: current.current };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = drag.current;
        if (start?.pointer === event.pointerId) update(start.height + event.clientY - start.y);
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        const next = {
          ArrowUp: current.current - 24,
          ArrowDown: current.current + 24,
          Home: minimum,
          End: maximum,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        update(next);
        save();
      },
    },
  };
}
