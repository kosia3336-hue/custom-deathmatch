'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { getSocket } from '@/lib/socket';

interface Props {
  kind: 'set' | 'unset';
  titleId?: string;
}

export default function TitleActions({ kind, titleId }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'set_displayed_title', {
          p_title_id: kind === 'set' ? (titleId as string) : null,
        });
        toast.success(kind === 'set' ? '표시 칭호가 변경되었습니다' : '표시 칭호를 해제했습니다');
        // 소켓 세션의 칭호 캐시 즉시 갱신 (채팅/랭크 매칭 표기용)
        try {
          getSocket().emit('skin:sync', () => {});
        } catch {
          /* 소켓 미연결 시 무시 — 다음 접속에서 자동 반영 */
        }
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  if (kind === 'set' && !titleId) return null;

  return (
    <Button variant={kind === 'set' ? 'secondary' : 'ghost'} size="sm" loading={busy} onClick={run}>
      {kind === 'set' ? '이 칭호로 표시' : '표시 해제'}
    </Button>
  );
}
