'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { getSocket } from '@/lib/socket';

interface Props {
  skinId: string;
  equipped: boolean;
}

export default function SkinActions({ skinId, equipped }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        if (equipped) {
          await callRpc(sb, 'unequip_skin', { p_skin_id: skinId });
          toast.success('스킨을 해제했습니다.');
        } else {
          await callRpc(sb, 'equip_skin', { p_skin_id: skinId });
          toast.success('스킨을 착용했습니다.');
        }
        /* 서버 세션의 equippedSkins 를 즉시 갱신 — 다음 게임에 바로 반영 */
        try { getSocket().emit('skin:sync', () => {}); } catch { /* 소켓 미연결 시 무시 */ }
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Button
      variant={equipped ? 'ghost' : 'secondary'}
      size="sm"
      loading={busy}
      onClick={run}
    >
      {equipped ? '착용 해제' : '착용하기'}
    </Button>
  );
}
