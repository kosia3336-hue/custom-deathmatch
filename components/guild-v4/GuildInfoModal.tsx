'use client';

import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import type { GuildSummary } from '@/lib/guild/types';
import { GuildPublicBanner } from './GuildBanner';

export function GuildInfoModal({
  guild,
  busy,
  canApply,
  onClose,
  onJoin,
}: {
  guild: GuildSummary;
  busy: boolean;
  canApply: boolean;
  onClose: () => void;
  onJoin: () => Promise<void>;
}) {
  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={guild.name}
      size="lg"
      className="guild-info-modal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          {canApply ? (
            <Button loading={busy} onClick={() => void onJoin()}>
              가입 신청
            </Button>
          ) : null}
        </>
      }
    >
      <GuildPublicBanner guild={guild} inModal />
    </Modal>
  );
}
