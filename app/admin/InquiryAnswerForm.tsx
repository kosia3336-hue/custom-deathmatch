'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';

export default function InquiryAnswerForm({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, startTransition] = useTransition();

  function go() {
    if (body.trim().length < 5) {
      toast.error('답변은 5자 이상');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_answer_inquiry', { p_id: inquiryId, p_body: body.trim() });
        toast.success('답변이 등록되었습니다');
        setBody('');
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="답변을 입력하세요..."
        className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={go} loading={busy}>답변 등록</Button>
      </div>
    </div>
  );
}
