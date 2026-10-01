'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { mapInquiryError, type InquiryCategoryRow } from '@/lib/inquiry/categories';

export default function InquiryCategoryManage({
  categories,
}: {
  categories: InquiryCategoryRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, startTransition] = useTransition();

  function add() {
    const t = label.trim();
    if (t.length < 1 || t.length > 20) {
      toast.error('분류 이름은 1~20자로 적어 주세요.');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_create_inquiry_category', { p_label: t });
        toast.success('분류를 추가했습니다.');
        setLabel('');
        router.refresh();
      } catch (e) {
        toast.error(mapInquiryError(e));
      }
    });
  }

  function setActive(slug: string, active: boolean) {
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_set_inquiry_category_active', { p_slug: slug, p_active: active });
        toast.success(active ? '다시 받기 시작했습니다.' : '새 문의에서 빼 두었습니다.');
        router.refresh();
      } catch (e) {
        toast.error(mapInquiryError(e));
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        분류 관리
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="문의 분류"
        size="md"
      >
        <p className="mb-3 text-xs text-cdm-fg-muted">
          끄면 회원은 그 분류로 새로 넣지 못합니다. 예전 문의는 필터에서 그대로 볼 수 있고, 다시 켜면 접수에도 돌아옵니다.
        </p>
        <div className="mb-4 flex gap-2">
          <div className="min-w-0 flex-1">
            <TextInput
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="새 분류 이름"
              maxLength={20}
            />
          </div>
          <Button size="sm" onClick={add} loading={busy}>
            추가
          </Button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {categories.map((c) => (
            <li
              key={c.slug}
              className="flex items-center justify-between gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cdm-fg">{c.label}</p>
                <p className="text-[11px] text-cdm-fg-muted">
                  {c.is_active ? '받는 중' : '종료'}
                  {c.is_system ? ' · 필수' : ''}
                </p>
              </div>
              {c.is_system ? (
                <span className="shrink-0 text-[11px] text-cdm-fg-subtle">변경 불가</span>
              ) : c.is_active ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setActive(c.slug, false)}
                >
                  사용 중지
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setActive(c.slug, true)}
                >
                  다시 사용
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
