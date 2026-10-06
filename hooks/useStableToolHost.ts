import { useLayoutEffect, useState, type RefObject } from 'react';
import type { DockRegions, ToolEdge } from './useDockTargets';

/** 같은 portal DOM을 옮긴다. 도킹/순서 변경 때 내용의 React 수명을 유지한다. */
export function useStableToolHost(
  regions: RefObject<DockRegions>,
  edge: ToolEdge,
  id: string,
  order: string[],
  className: string,
) {
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const element = document.createElement('div');
    element.className = className;
    element.dataset.toolId = id;
    return element;
  });
  useLayoutEffect(() => {
    const region = regions.current[edge];
    if (!host || !region) return;
    const index = order.indexOf(id);
    const next = Array.from(region.children).find(
      (item) => item !== host && order.indexOf((item as HTMLElement).dataset.toolId ?? '') > index,
    );
    if (host.parentElement !== region || host.nextElementSibling !== (next ?? null))
      region.insertBefore(host, next ?? null);
  }, [host, edge, regions, id, order]);
  useLayoutEffect(
    () => () => {
      host?.remove();
    },
    [host],
  );
  return host;
}
