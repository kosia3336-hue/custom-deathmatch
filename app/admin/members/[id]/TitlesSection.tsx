'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { MemberTitleData, TitleData } from './types';

interface Props {
  memberId: string;
  nickname: string;
  memberTitles: MemberTitleData[];
  allActiveTitles: TitleData[];
  isWithdrawn: boolean;
}

export default function TitlesSection({
  memberId,
  nickname,
  memberTitles,
  allActiveTitles,
  isWithdrawn,
}: Props) {
  const [openGrant, setOpenGrant] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<MemberTitleData | null>(null);

  const activeTitles = memberTitles.filter((t) => !t.revoked_at);

  return (
    <div className="flex flex-col gap-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-cdm-fg-muted">보유 {activeTitles.length}개</span>
        {!isWithdrawn && (
          <Button size="sm" onClick={() => setOpenGrant(true)}>
            + 칭호 부여
          </Button>
        )}
      </div>

      {activeTitles.length === 0 && (
        <p className="text-xs text-cdm-fg-subtle">보유 칭호가 없습니다.</p>
      )}

      {activeTitles.map((t) => (
        <Card key={t.id} className="!p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TitleBadge name={t.title.name} color={t.title.color} size="md" />
            {!isWithdrawn && (
              <Button size="sm" variant="danger" onClick={() => setRevokeTarget(t)}>
                압수
              </Button>
            )}
          </div>
          <div className="mt-1.5 text-xs text-cdm-fg-muted">
            부여 {new Date(t.granted_at).toLocaleDateString('ko-KR')}
            {t.granter_nickname && ` · by ${t.granter_nickname}`}
            {t.reason && ` · "${t.reason}"`}
          </div>
        </Card>
      ))}

      <GrantTitleModal
        open={openGrant}
        onClose={() => setOpenGrant(false)}
        memberId={memberId}
        nickname={nickname}
        allActiveTitles={allActiveTitles}
        ownedTitleIds={activeTitles.map((t) => t.title_id)}
      />
      {revokeTarget && (
        <RevokeTitleModal
          open
          onClose={() => setRevokeTarget(null)}
          memberId={memberId}
          nickname={nickname}
          memberTitle={revokeTarget}
        />
      )}
    </div>
  );
}

function GrantTitleModal({
  open,
  onClose,
  memberId,
  nickname,
  allActiveTitles,
  ownedTitleIds,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  nickname: string;
  allActiveTitles: TitleData[];
  ownedTitleIds: string[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, startTransition] = useTransition();

  const selectedTitle = allActiveTitles.find((t) => t.id === selectedId);
  const alreadyOwned = selectedId !== '' && ownedTitleIds.includes(selectedId);

  useEffect(() => {
    if (open) {
      setSelectedId('');
      setReason('');
    }
  }, [open]);

  function go() {
    if (!selectedId) {
      toast.error('칭호를 선택해주세요');
      return;
    }
    if (!reason.trim()) {
      toast.error('사유를 입력해주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_grant_title', {
          p_member_id: memberId,
          p_title_id: selectedId,
          p_reason: reason.trim(),
        });
        toast.success(`${nickname}에게 칭호 부여 완료`);

        const title = allActiveTitles.find((t) => t.id === selectedId);
        if (title) {
          fetch('/api/admin/notify-title-granted', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId,
              titleId: title.id,
              name: title.name,
              color: title.color,
              description: title.description ?? null,
            }),
          }).catch(() => {});
        }

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
      title={`${nickname} 칭호 부여`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button onClick={go} loading={busy}>
            부여
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">칭호 *</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
          >
            <option value="">선택하세요</option>
            {allActiveTitles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {ownedTitleIds.includes(t.id) ? ' (이미 보유)' : ''}
              </option>
            ))}
          </select>
          {selectedTitle && (
            <div className="mt-1 pl-1">
              <TitleBadge name={selectedTitle.name} color={selectedTitle.color} size="sm" />
            </div>
          )}
          {alreadyOwned && (
            <p className="text-xs text-cdm-fg-muted">
              이미 보유 중입니다. 부여 시 사유가 업데이트됩니다.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">사유 *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="부여 사유를 입력하세요"
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
          />
        </div>
      </div>
    </Modal>
  );
}

function RevokeTitleModal({
  open,
  onClose,
  memberId,
  nickname,
  memberTitle,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  nickname: string;
  memberTitle: MemberTitleData;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  function go() {
    if (!reason.trim()) {
      toast.error('사유를 입력해주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_revoke_title', {
          p_member_id: memberId,
          p_title_id: memberTitle.title_id,
          p_reason: reason.trim(),
        });
        toast.success(`"${memberTitle.title.name}" 칭호 압수 완료`);
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
      title={`"${memberTitle.title.name}" 압수`}
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="danger" onClick={go} loading={busy}>
            압수
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2.5">
          <TitleBadge name={memberTitle.title.name} color={memberTitle.title.color} size="sm" />
          <span className="text-xs text-cdm-fg-muted">→ {nickname}</span>
        </div>
        <p className="text-xs text-cdm-fg-muted">
          압수 시 회원에게 알림이 발송되며, 표시 칭호였다면 자동으로 해제됩니다.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">사유 *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="압수 사유를 입력하세요"
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
          />
        </div>
      </div>
    </Modal>
  );
}
