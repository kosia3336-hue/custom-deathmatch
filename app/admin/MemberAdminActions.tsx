'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { MemberStatus } from '@/lib/supabase/database.types';

interface Props {
  memberId: string;
  nickname: string;
  currentStatus: MemberStatus;
  currentRole: 'user' | 'admin';
}

export default function MemberAdminActions({
  memberId,
  nickname,
  currentStatus,
  currentRole,
}: Props) {
  const router = useRouter();
  const [openSuspend, setOpenSuspend] = useState(false);
  const [openBan, setOpenBan] = useState(false);
  const [openLift, setOpenLift] = useState(false);
  const [busy, startTransition] = useTransition();

  function toggleRole() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_set_role', {
          p_member_id: memberId,
          p_role: currentRole === 'admin' ? 'user' : 'admin',
        });
        toast.success(`역할이 ${currentRole === 'admin' ? 'user' : 'admin'} 로 변경되었습니다`);
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {currentStatus === 'active' && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setOpenSuspend(true)}>
              일시정지
            </Button>
            <Button size="sm" variant="danger" onClick={() => setOpenBan(true)}>
              영구정지
            </Button>
          </>
        )}
        {(currentStatus === 'suspended' || currentStatus === 'banned') && (
          <Button size="sm" variant="secondary" onClick={() => setOpenLift(true)}>
            제재 해제
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={toggleRole} loading={busy}>
          {currentRole === 'admin' ? '관리자 해제' : '관리자 부여'}
        </Button>
      </div>

      <LiftModal
        open={openLift}
        onClose={() => setOpenLift(false)}
        memberId={memberId}
        nickname={nickname}
      />
      <SuspendModal
        open={openSuspend}
        onClose={() => setOpenSuspend(false)}
        memberId={memberId}
        nickname={nickname}
      />
      <BanModal
        open={openBan}
        onClose={() => setOpenBan(false)}
        memberId={memberId}
        nickname={nickname}
      />
    </>
  );
}

function SuspendModal({
  open,
  onClose,
  memberId,
  nickname,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  nickname: string;
}) {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [busy, startTransition] = useTransition();

  function go() {
    if (!reason.trim()) {
      toast.error('사유를 입력해 주세요');
      return;
    }
    const until = new Date(Date.now() + days * 86400_000).toISOString();
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_suspend_member', {
          p_member_id: memberId,
          p_until: until,
          p_reason: reason.trim(),
        });
        toast.success(`${nickname} 일시정지 (${days}일)`);
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${nickname} 일시정지`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button onClick={go} loading={busy}>
            정지
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">기간 (일)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 0)))}
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="일시정지 사유"
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
          />
        </div>
      </div>
    </Modal>
  );
}

function BanModal({
  open,
  onClose,
  memberId,
  nickname,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  nickname: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, startTransition] = useTransition();

  function go() {
    if (!reason.trim()) {
      toast.error('사유를 입력해 주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_ban_member', {
          p_member_id: memberId,
          p_reason: reason.trim(),
        });
        toast.success(`${nickname} 영구정지`);
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${nickname} 영구정지`}
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="danger" onClick={go} loading={busy}>
            영구정지
          </Button>
        </>
      }
    >
      <p className="text-sm text-cdm-fg-muted">
        이 작업은 즉시 적용되며, 회원이 다시는 로그인할 수 없습니다.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">사유</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="영구정지 사유"
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
        />
      </div>
    </Modal>
  );
}

function LiftModal({
  open,
  onClose,
  memberId,
  nickname,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  nickname: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  function go() {
    if (!reason.trim()) {
      toast.error('사유를 입력해 주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_lift_sanction', {
          p_member_id: memberId,
          p_reason: reason.trim(),
        });
        toast.success(`${nickname} 제재가 해제되었습니다`);
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${nickname} 제재 해제`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button onClick={go} loading={busy}>
            해제
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">사유 *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="제재 해제 사유를 입력하세요"
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
        />
      </div>
    </Modal>
  );
}

// GrantTitleModal 은 /admin/members/[id]/TitlesSection.tsx 로 이전됨
