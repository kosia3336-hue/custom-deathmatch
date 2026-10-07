'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { gameWorkspaceHeight } from '@/lib/gameWorkspaceSize';

/** 남은 높이가 부족해도 판을 0으로 줄이지 않고 바깥 화면에 스크롤을 만든다. */
export function useGameWorkspaceSize(
  viewport: RefObject<HTMLDivElement | null>,
  canvas: RefObject<HTMLDivElement | null>,
) {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const outer = viewport.current;
    const inner = canvas.current;
    if (!outer || !inner) return;
    let scheduled = 0;
    const measure = () => {
      const frame = Array.from(inner.querySelectorAll<HTMLElement>('[data-game-frame]')).find(
        (element) => element.getClientRects().length > 0,
      );
      if (!frame) {
        setHeight(undefined);
        return;
      }
      const style = getComputedStyle(frame);
      const chrome = Array.from(frame.children).filter(
        (element) => !element.hasAttribute('data-game-stage-row'),
      );
      const frameChrome =
        chrome.reduce((sum, element) => sum + element.getBoundingClientRect().height, 0) +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        (parseFloat(style.borderTopWidth) || 0) +
        (parseFloat(style.borderBottomWidth) || 0) +
        (parseFloat(style.bottom) || 0) +
        (parseFloat(style.rowGap) || 0) * Math.max(0, frame.children.length - 1);
      const stageContent = Math.max(
        0,
        ...Array.from(
          frame.querySelectorAll<HTMLElement>('[data-game-intrinsic-stage]'),
          (element) => Math.max(element.getBoundingClientRect().height, element.scrollHeight),
        ),
      );
      const topBottom = Array.from(inner.querySelectorAll<HTMLElement>('[data-game-dock-edge]'))
        .filter((element) => ['top', 'bottom'].includes(element.dataset.gameDockEdge ?? ''))
        .reduce((sum, element) => sum + element.getBoundingClientRect().height, 0);
      const workspace = getComputedStyle(inner);
      const workspaceChrome =
        parseFloat(workspace.paddingTop) +
        parseFloat(workspace.paddingBottom) +
        (workspace.display === 'grid' ? (parseFloat(workspace.rowGap) || 0) * 2 : 0);
      const next = gameWorkspaceHeight({
        viewport: outer.clientHeight,
        frameChrome,
        stageMinimum: parseFloat(style.getPropertyValue('--game-stage-min-height')) || 320,
        stageContent,
        docks: topBottom,
        workspaceChrome,
      });
      setHeight((previous) => (previous === next ? previous : next));
    };
    const schedule = () => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    const observe = () => {
      resize.disconnect();
      resize.observe(outer);
      resize.observe(inner);
      inner
        .querySelectorAll<HTMLElement>(
          '[data-game-frame], [data-game-frame] > div, [data-game-intrinsic-stage], [data-game-dock-edge]',
        )
        .forEach((element) => resize.observe(element));
    };
    const mutation = new MutationObserver(() => {
      observe();
      schedule();
    });
    mutation.observe(inner, { childList: true, subtree: true });
    observe();
    measure();
    return () => {
      cancelAnimationFrame(scheduled);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [canvas, viewport]);
  return height;
}
