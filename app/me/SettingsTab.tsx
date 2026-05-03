'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import { Modal } from '@/components/cdm/Modal';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { useRouter } from 'next/navigation';

export default function SettingsTab() {
  const router = useRouter();
  const [openWithdraw, setOpenWithdraw] = useState(false);
  const [openNick, setOpenNick] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">계정</h2>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setOpenNick(true)}>
            닉네임 변경 (30일에 1회)
          </Button>
          <a href="/auth/signout">
            <Button variant="secondary" fullWidth>
              로그아웃
            </Button>
          </a>
          <Button variant="danger" onClick={() => setOpenWithdraw(true)}>
            회원 탈퇴
          </Button>
        </div>
      </Card>

      <NicknameModal open={openNick} onClose={() => setOpenNick(false)} onDone={() => router.refresh()} />
      <WithdrawModal open={openWithdraw} onClose={() => setOpenWithdraw(false)} />
    </div>
  );
}

function NicknameModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nick, setNick] = useState('');
  const [submitting, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        try {
          await callRpc(supabase, 'change_nickname', { p_new_nick: nick.trim() });
        } catch (rpcErr) {
          const code = (rpcErr as { code?: string }).code;
          if (code === '22023') {
            toast.error('닉네임은 30일에 한 번만 변경할 수 있습니다');
            return;
          }
          if (code === '23505') {
            toast.error('사용할 수 없는 닉네임입니다');
            return;
          }
          throw rpcErr;
        }
        toast.success('닉네임이 변경되었습니다');
        onClose();
        onDone();
      } catch (e) {
        toast.error(`변경 실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="닉네임 변경"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            변경
          </Button>
        </>
      }
    >
      <TextInput
        label="새 닉네임"
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        placeholder="2~8자 한글/영문/숫자"
        maxLength={16}
        autoFocus
      />
    </Modal>
  );
}

function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [submitting, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        try {
          await callRpc(supabase, 'withdraw_member', {
            p_confirm_nick: confirm.trim(),
          });
        } catch (rpcErr) {
          const code = (rpcErr as { code?: string }).code;
          if (code === '22023') {
            toast.error('닉네임이 일치하지 않습니다');
            return;
          }
          throw rpcErr;
        }
        window.location.href = '/auth/signout';
      } catch (e) {
        toast.error(`탈퇴 실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="정말 탈퇴하시겠어요?"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting} disabled={confirm.trim().length < 2}>
            탈퇴
          </Button>
        </>
      }
    >
      <p className="text-sm text-cdm-fg-muted">
        탈퇴하면 닉네임/카카오 연결이 삭제되고, 게임 로그의 닉네임은 "탈퇴 회원"으로
        익명화됩니다. 보유 칭호는 회수됩니다.
      </p>
      <div className="mt-4">
        <TextInput
          label="확인을 위해 본인 닉네임을 입력하세요"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
  );
}
