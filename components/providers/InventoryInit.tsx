'use client';

import { useEffect } from 'react';
import { useInventoryStore, type InventoryMap } from '@/stores/inventory';
import { getSocket } from '@/lib/socket';
import type { ConsumableKind } from '@/lib/cdp/types';

/**
 * 로그인 상태에서 마운트되어:
 *  1) /api/me/consumables 1회 fetch → store
 *  2) inventory:updated 소켓 리스너 → store 갱신
 *
 * 비로그인 시는 mount 자체를 안 하거나 (hasMember=false) reset 만 호출.
 */
export default function InventoryInit({ hasMember }: { hasMember: boolean }) {
  const setAll = useInventoryStore((s) => s.setAll);
  const setOne = useInventoryStore((s) => s.setOne);
  const reset = useInventoryStore((s) => s.reset);

  useEffect(() => {
    if (!hasMember) {
      reset();
      return;
    }
    let aborted = false;

    fetch('/api/me/consumables', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ items: Array<{ kind: ConsumableKind; count: number }> }>)
      .then((json) => {
        if (aborted) return;
        const map = json.items.reduce<InventoryMap>(
          (acc, it) => {
            acc[it.kind] = Number(it.count);
            return acc;
          },
          { nickname_change: 0, rank_reset: 0, spectator_lock: 0, anonymity: 0, magnifier: 0, ban_eraser: 0 },
        );
        setAll(map);
      })
      .catch(() => {
        // 무시 (서버 오류) — store 는 null 인 채로 유지.
      });

    const socket = getSocket();
    const onUpdated = (p: { kind: ConsumableKind; countAfter: number }) => {
      setOne(p.kind, Number(p.countAfter));
    };
    socket.on('inventory:updated', onUpdated);

    return () => {
      aborted = true;
      socket.off('inventory:updated', onUpdated);
    };
  }, [hasMember, setAll, setOne, reset]);

  return null;
}
