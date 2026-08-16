'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { getSocket } from '@/lib/socket';

function mapRpcError(message: string): string {
  if (message.includes('Legend titles cannot equip effects')) {
    return '레전드 칭호에는 이펙트를 장착할 수 없습니다';
  }
  if (message.includes('Effect not owned')) return '보유하지 않은 이펙트입니다';
  if (message.includes('Effect not found')) return '이펙트를 찾을 수 없습니다';
  return message;
}

interface Props {
  kind: 'set' | 'unset';
  effectId?: string;
  blocked?: boolean;
}

export default function EffectActions({ kind, effectId, blocked = false }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'set_displayed_effect', {
          p_effect_id: kind === 'set' ? (effectId as string) : null,
        });
        toast.success(kind === 'set' ? '이펙트를 장착했습니다' : '이펙트를 해제했습니다');
        try {
          getSocket().emit('skin:sync', () => {});
        } catch {
          /* 소켓 미연결 시 무시 */
        }
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${mapRpcError((e as Error).message ?? '')}`);
      }
    });
  }

  if (kind === 'set' && !effectId) return null;

  return (
    <Button
      variant={kind === 'set' ? 'secondary' : 'ghost'}
      size="sm"
      loading={busy}
      disabled={kind === 'set' && blocked}
      onClick={run}
    >
      {kind === 'set' ? '장착' : '해제'}
    </Button>
  );
}
