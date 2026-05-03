'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { TitleColor } from '@/lib/supabase/database.types';

interface Props {
  memberId: string;
  memberNickname: string;
  titleId: string;
  titleName: string;
  titleColor: TitleColor;
}

export default function TitleOwnerActions({
  memberId,
  memberNickname,
  titleId,
  titleName,
  titleColor,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  function revoke() {
    if (!reason.trim()) {
      toast.error('사유를 입력해주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_revoke_title', {
          p_member_id: memberId,
          p_title_id: titleId,
          p_reason: reason.trim(),
        });
        toast.success(`"${titleName}" 칭호 회수 완료`);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        회수
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`"${titleName}" 회수`}
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              취소
            </Button>
            <Button variant="danger" onClick={revoke} loading={busy}>
              회수
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2.5">
            <TitleBadge name={titleName} color={titleColor} size="sm" />
            <span className="text-xs text-cdm-fg-muted">→ {memberNickname}</span>
          </div>
          <p className="text-xs text-cdm-fg-muted">
            회수 시 회원에게 알림이 발송되며, 표시 칭호였다면 자동으로 해제됩니다.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cdm-fg">사유 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="회수 사유를 입력하세요"
              className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
