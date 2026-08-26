'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';

interface DevUser {
  id: string;
  nickname: string;
}

export function DevSwitchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsers(null);
    fetch('/api/admin/dev-switch')
      .then(async (r) => {
        const data = (await r.json()) as { users?: DevUser[]; error?: string };
        if (!r.ok) throw new Error(data.error ?? '목록 실패');
        setUsers(data.users ?? []);
      })
      .catch((e: Error) => {
        toast.error(e.message);
        setUsers([]);
      });
  }, [open]);

  async function switchTo(user: DevUser) {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const r = await fetch('/api/admin/dev-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: user.id }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? '전환 실패');
      window.location.assign('/lobby');
    } catch (e) {
      toast.error((e as Error).message);
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="데브 전환" size="sm" showClose>
      <p className="mb-3 text-sm text-cdm-fg-muted">
        천하와 더미 회원 사이를 전환합니다. 소켓·잔액이 그 계정으로 바뀝니다.
      </p>
      {users === null ? (
        <p className="text-sm text-cdm-fg-muted">불러오는 중…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-cdm-fg-muted">데브 유저가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {users.map((u) => (
            <li key={u.id}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                fullWidth
                loading={busyId === u.id}
                disabled={busyId !== null}
                onClick={() => void switchTo(u)}
              >
                {u.nickname}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
