'use client';

import { useEffect, useEffectEvent, type DependencyList } from 'react';

/** 서버 단계 변경에 따른 연출은 다음 그리기 프레임에 시작하고, 교체·unmount 때 취소한다. */
export function usePresentationEffect(
  start: () => void | (() => void),
  dependencies: DependencyList,
) {
  const begin = useEffectEvent(start);
  useEffect(() => {
    let cleanup: void | (() => void);
    const frame = requestAnimationFrame(() => {
      cleanup = begin();
    });
    return () => {
      cancelAnimationFrame(frame);
      cleanup?.();
    };
    // 연출의 재시작 조건은 호출부가 지정한다. 최신 콜백은 effect event가 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
