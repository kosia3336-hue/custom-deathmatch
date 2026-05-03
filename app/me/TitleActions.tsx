'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';

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
