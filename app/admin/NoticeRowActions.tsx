'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { NoticeCategory } from '@/lib/supabase/database.types';

interface RowProps {
  notice: {
    id: string;
    category: NoticeCategory;
    title: string;
    body: string;
    isPinned: boolean;
    isPublished: boolean;
  };
  /** 현재 게시된 핀 공지 개수 (3개 초과 경고용) */
  pinnedCount: number;
}

const PIN_LIMIT_SOFT = 3;

export default function NoticeRowActions({ notice, pinnedCount }: RowProps) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [busy, startTransition] = React.useTransition();

  function togglePin() {
    const next = !notice.isPinned;
    if (next && notice.isPublished && pinnedCount >= PIN_LIMIT_SOFT) {
      const ok = window.confirm(
        `현재 ${pinnedCount}개의 공지가 상단 고정되어 있습니다.\n` +
          `${PIN_LIMIT_SOFT}개를 초과해 핀하면 사용자 화면이 복잡해질 수 있습니다.\n` +
          `그래도 진행할까요?`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_toggle_notice_pin', {
          p_id: notice.id,
          p_pinned: next,
        });
        toast.success(next ? '상단 고정되었습니다' : '상단 고정 해제되었습니다');
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  function togglePublished() {
    const next = !notice.isPublished;
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_set_notice_published', {
          p_id: notice.id,
          p_published: next,
        });
        toast.success(next ? '공개되었습니다' : '비공개로 변경되었습니다');
        // 비공개 → 공개 전환 시 실시간 알림 전송
        if (next) {
          void fetch('/api/admin/notify-notice-published', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              noticeId: notice.id,
              title: notice.title,
              category: notice.category,
            }),
          }).catch(() => {});
        }
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  function deleteIt() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_delete_notice', { p_id: notice.id });
        toast.success('공지가 삭제되었습니다');
        setConfirmingDelete(false);
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-t border-cdm-border pt-2">
        <Link
          href={`/notice/${notice.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-cdm-primary hover:text-cdm-primary-strong"
        >
          미리보기 ↗
        </Link>
        <span className="text-cdm-fg-subtle">·</span>
        <Link
          href={`/admin/notices/${notice.id}/edit`}
          className="text-xs font-semibold text-cdm-fg-muted hover:text-cdm-fg"
        >
          편집
        </Link>
        <button
          type="button"
          onClick={togglePin}
          disabled={busy}
          className="text-xs font-semibold text-cdm-fg-muted hover:text-cdm-fg disabled:opacity-50"
        >
          {notice.isPinned ? '핀 해제' : '상단 고정'}
        </button>
        <button
          type="button"
          onClick={togglePublished}
          disabled={busy}
          className="text-xs font-semibold text-cdm-fg-muted hover:text-cdm-fg disabled:opacity-50"
        >
          {notice.isPublished ? '비공개로' : '공개로'}
        </button>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          className="text-xs font-semibold text-cdm-accent hover:text-cdm-accent-strong disabled:opacity-50"
        >
          삭제
        </button>
      </div>

      {/* 삭제 확인 */}
      <Modal
        open={confirmingDelete}
        onClose={() => !busy && setConfirmingDelete(false)}
        title="공지 삭제"
        size="sm"
        closeOnBackdrop={!busy}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              취소
            </Button>
            <Button variant="danger" onClick={deleteIt} loading={busy}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-cdm-fg">
          공지 <strong className="font-semibold">[{notice.title}]</strong> 을(를) 삭제할까요?
        </p>
        <p className="mt-2 text-xs text-cdm-fg-muted">
          본문 스냅샷은 관리자 로그(<code>admin_actions.payload.body</code>)에 저장되며, 삭제 작업은
          되돌릴 수 없습니다. 임시로 숨기려면 <strong>비공개</strong> 토글을 사용하세요.
        </p>
      </Modal>
    </>
  );
}
