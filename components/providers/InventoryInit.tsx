'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useInventoryStore, type InventoryMap, type AutoUseMap } from '@/stores/inventory';
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
      .then((r) => r.json() as Promise<{ items: Array<{ kind: ConsumableKind; count: number; autoUse: boolean }> }>)
      .then((json) => {
        if (aborted) return;
        const map = json.items.reduce<InventoryMap>(
          (acc, it) => { acc[it.kind] = Number(it.count); return acc; },
          { nickname_change: 0, rank_reset: 0, spectator_lock: 0, anonymity: 0, magnifier: 0, ban_eraser: 0, gacha_box: 0, gacha_ticket: 0, guild_charter: 0, word_search: 0, counter_charm: 0, calm_charm: 0, demotion_shield: 0 },
        );
        const autoUseMap = json.items.reduce<AutoUseMap>(
          (acc, it) => { acc[it.kind] = it.autoUse ?? true; return acc; },
          { nickname_change: true, rank_reset: true, spectator_lock: true, anonymity: true, magnifier: true, ban_eraser: true, gacha_box: false, gacha_ticket: false, guild_charter: false, word_search: true, counter_charm: true, calm_charm: true, demotion_shield: true },
        );
        setAll(map, autoUseMap);
      })
      .catch(() => {
        // 무시 (서버 오류) — store 는 null 인 채로 유지.
      });

    const socket = getSocket();
    const onUpdated = (p: { kind: ConsumableKind; countAfter: number; reason?: string }) => {
      setOne(p.kind, Number(p.countAfter));
      // 하루 5승 뽑기 박스 지급 안내
      if (p.reason === 'daily_reward' && p.kind === 'gacha_box') {
        toast.success('오늘 랭크 5승 달성! 뽑기 박스 1개를 받았습니다.');
      }
    };
    socket.on('inventory:updated', onUpdated);

    return () => {
      aborted = true;
      socket.off('inventory:updated', onUpdated);
    };
  }, [hasMember, setAll, setOne, reset]);

  return null;
}
