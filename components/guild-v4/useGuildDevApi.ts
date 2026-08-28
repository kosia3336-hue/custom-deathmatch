'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCdpStore } from '@/stores/cdp';
import { useGuildChatStore } from '@/stores/guildChat';
import type { GuildV4Snapshot } from '@/lib/guild-v4/types';
import { useGuildDevStore } from './store';
import type { DevGuildMe } from './dummy';

export function useGuildDevApi(me: DevGuildMe) {
  const hydrate = useGuildDevStore((s) => s.hydrate);
  const hydrated = useGuildDevStore((s) => s.hydrated);
  const guilds = useGuildDevStore((s) => s.guilds);
  const my = useGuildDevStore((s) => s.my);
  const [busy, setBusy] = useState(false);

  const applySnap = useCallback(
    (snap: GuildV4Snapshot) => {
      hydrate(snap);
      useCdpStore.getState().setBalance(snap.myCdp);
      useGuildChatStore.getState().setSeenMessageId(snap.chatSeenMessageId);
    },
    [hydrate],
  );

  const refresh = useCallback(async () => {
    const res = await fetch('/api/guild2');
    const json = (await res.json()) as GuildV4Snapshot & { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? '길드 정보를 불러오지 못했습니다.');
      return;
    }
    applySnap(json);
  }, [applySnap]);

  useEffect(() => {
    void refresh();
  }, [refresh, me.id]);

  const act = useCallback(
    async (payload: Record<string, unknown>, successMsg?: string): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch('/api/guild2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? '처리에 실패했습니다.');
          return false;
        }
        await refresh();
        if (successMsg) toast.success(successMsg);
        return true;
      } catch {
        toast.error('처리 중 오류가 발생했습니다.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { guilds, my, busy, act, refresh, hydrated, meId: me.id };
}
