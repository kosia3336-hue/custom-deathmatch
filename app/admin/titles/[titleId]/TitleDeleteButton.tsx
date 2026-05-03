'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { getBrowserSupabase } from '@/lib/supabase/client';

interface Props {
  titleId: string;
  titleName: string;
  activeOwnerCount: number;
}

export default function TitleDeleteButton({ titleId, titleName, activeOwnerCount }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        const { error } = await sb.from('titles').delete().eq('id', titleId);
        if (error) throw error;
        toast.success(`"${titleName}" 칭호 삭제 완료`);
        setOpen(false);
        router.push('/admin?tab=titles');
      } catch (e) {
        toast.error(`삭제 실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        칭호 삭제
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`"${titleName}" 삭제`}
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={busy}>
              삭제
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-cdm-fg">
          {activeOwnerCount > 0 ? (
            <div className="rounded-cdm-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              현재 이 칭호를 보유 중인 회원이 {activeOwnerCount}명 있습니다.
              삭제 전에 모두 회수하거나, DB 제약에 따라 삭제가 거부될 수 있습니다.
            </div>
          ) : null}
          <p className="text-cdm-fg-muted text-xs">
            칭호를 삭제하면 부여·회수 이력을 포함한 모든 데이터가 사라집니다.
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
      </Modal>
    </>
  );
}
