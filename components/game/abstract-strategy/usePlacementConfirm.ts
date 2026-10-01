'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { tapPlacement } from '@/lib/placementConfirm';

/*
  '마우스를 올릴 수 없는 손가락' 이 주 입력인 기기. 화면 너비로 가르면 좁은
  노트북 창이나 펜 달린 태블릿에서 어긋나므로 입력 방식으로 가른다.
*/
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

function subscribe(onChange: () => void) {
  const mq = typeof window !== 'undefined' ? window.matchMedia?.(TOUCH_QUERY) : undefined;
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

export function useTouchPrimary(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(TOUCH_QUERY).matches ?? false,
    () => false,
  );
}

/**
 * 착수 두 번 탭 (lib/placementConfirm.ts).
 *
 * `resetKey` 는 턴·단계처럼 '보여 주던 자리가 더는 의미 없어지는' 값이다.
 * 바뀌면 보여 주던 자리를 저절로 버린다 — effect 로 비우면 한 번 그려진 뒤
 * 사라져 깜빡이고, 그 사이 누른 탭이 지난 턴 자리로 두어질 수 있다.
 */
export function usePlacementConfirm(resetKey: string) {
  const touch = useTouchPrimary();
  const [state, setState] = useState<{ resetKey: string; armed: string | null }>({
    resetKey,
    armed: null,
  });
  const armed = state.resetKey === resetKey ? state.armed : null;

  const tap = useCallback(
    (key: string, commit: () => void) => {
      const next = tapPlacement(armed, key, touch);
      if (next.kind === 'commit') {
        setState({ resetKey, armed: null });
        commit();
        return;
      }
      setState({ resetKey, armed: next.key });
    },
    [armed, resetKey, touch],
  );

  const clear = useCallback(() => setState({ resetKey, armed: null }), [resetKey]);

  return { armed, tap, clear };
}
