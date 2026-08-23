'use client';

import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';

export type GuildConfirmVariant = 'primary' | 'danger';

export type GuildConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: GuildConfirmVariant;
  run: () => Promise<boolean>;
};

/** 브라우저 confirm() 대신. 소모·변경은 primary, 추방·탈퇴·해체·해제는 danger. */
export function GuildConfirmModal({
  pending,
  busy,
  onClose,
}: {
  pending: GuildConfirm | null;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(pending)}
      onClose={busy ? undefined : onClose}
      title={pending?.title}
      size="sm"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            variant={pending?.variant ?? 'primary'}
            loading={busy}
            onClick={() => {
              if (!pending) return;
              void pending.run().then((ok) => {
                if (ok) onClose();
              });
            }}
          >
            {pending?.confirmLabel ?? '확인'}
          </Button>
        </>
      }
    >
      {pending?.message
        ? pending.message.split('\n').map((line) => (
            <p key={line} className="text-sm text-cdm-fg">
              {line}
            </p>
          ))
        : null}
    </Modal>
  );
}
