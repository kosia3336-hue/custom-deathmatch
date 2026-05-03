'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { ReportResolution } from '@/lib/supabase/database.types';

export default function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<ReportResolution | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [busy, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        if (open === 'reject') {
          await callRpc(sb, 'admin_reject_report', {
            p_report_id: reportId,
            p_reason: reason.trim() || undefined,
          });
          toast.success('신고가 반려되었습니다');
        } else if (open) {
          const args: Parameters<typeof callRpc<'admin_resolve_report'>>[2] = {
            p_report_id: reportId,
            p_resolution: open,
            p_reason: reason.trim() || undefined,
          };
          if (open === 'suspended') {
            args.p_sanction_until = new Date(Date.now() + days * 86400_000).toISOString();
          }
          await callRpc(sb, 'admin_resolve_report', args);
          toast.success('신고가 처리되었습니다');
        }
        setOpen(null);
        setReason('');
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setOpen('warning')}>
          경고
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen('suspended')}>
          일시정지
        </Button>
        <Button size="sm" variant="danger" onClick={() => setOpen('banned')}>
          영구정지
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen('reject')}>
          반려
        </Button>
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={
          open === 'warning' ? '경고 보내기' :
          open === 'suspended' ? '일시정지 처분' :
          open === 'banned' ? '영구정지 처분' :
          open === 'reject' ? '신고 반려' : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)} disabled={busy}>취소</Button>
            <Button onClick={go} loading={busy} variant={open === 'banned' ? 'danger' : 'primary'}>
              확인
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {open === 'suspended' && (
            <TextInput
              label="기간 (일)"
              type="number"
              min={1}
              max={365}
              value={String(days)}
              onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 0)))}
            />
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cdm-fg">사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
