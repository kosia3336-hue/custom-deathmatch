import { useEffect, type RefObject } from 'react';
import type { DockRegions } from './useDockTargets';
import { shouldRevealDock } from '@/lib/dockWheel';

export function useDockWheel(regions: RefObject<DockRegions>, desktop: boolean) {
  useEffect(() => {
    if (!desktop) return;
    // 상·하 영역은 가로 배열이다. 세로로 스크롤할 내용이 없으면 일반 휠도 가로 이동에 쓴다.
    const cleanups = (['top', 'bottom'] as const).flatMap((edge) => {
      const region = regions.current[edge];
      if (!region) return [];
      const onWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        const canScrollY = (element: HTMLElement) => {
          const overflow = getComputedStyle(element).overflowY;
          if (!['auto', 'scroll'].includes(overflow)) return false;
          const max = element.scrollHeight - element.clientHeight;
          return (
            max > 1 && (event.deltaY > 0 ? element.scrollTop < max - 1 : element.scrollTop > 1)
          );
        };
        let current = event.target instanceof HTMLElement ? event.target : null;
        while (current && region.contains(current)) {
          if (canScrollY(current)) return;
          if (current === region) break;
          current = current.parentElement;
        }
        const viewport = region.closest<HTMLElement>('[data-game-scroll-viewport]');
        const viewportBounds = viewport?.getBoundingClientRect();
        if (
          viewport &&
          viewportBounds &&
          shouldRevealDock(event.deltaY, region.getBoundingClientRect(), {
            top: viewportBounds.top,
            bottom: viewportBounds.bottom,
            scrollTop: viewport.scrollTop,
            maxScroll: viewport.scrollHeight - viewport.clientHeight,
          })
        ) {
          const scale =
            event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
          const previous = viewport.scrollTop;
          viewport.scrollTop += event.deltaY * scale;
          if (viewport.scrollTop !== previous) event.preventDefault();
          return;
        }
        if (region.scrollWidth <= region.clientWidth + 1) return;
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? region.clientWidth : 1;
        const previous = region.scrollLeft;
        region.scrollLeft += event.deltaY * scale;
        if (region.scrollLeft !== previous) event.preventDefault();
      };
      region.addEventListener('wheel', onWheel, { passive: false });
      return [() => region.removeEventListener('wheel', onWheel)];
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [desktop, regions]);
}
