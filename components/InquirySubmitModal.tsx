'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { AttachmentPicker, linkAttachments, type AttachedFile } from '@/components/support/AttachmentPicker';
import { mapInquiryError, pickSubmitCategory } from '@/lib/inquiry/categories';
import { useInquiryCategories } from '@/hooks/useInquiryCategories';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reasonTag?: string | null;
}

export default function InquirySubmitModal({ open, onClose, onSuccess, reasonTag }: Props) {
  const { cats, loading } = useInquiryCategories({ activeOnly: true, enabled: open });
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setTitle('');
      setBody('');
      setFiles([]);
    }
  }, [open, reasonTag]);

  useEffect(() => {
    if (!open || cats.length === 0) return;
    setCategory((prev) =>
      cats.some((c) => c.slug === prev) ? prev : pickSubmitCategory(reasonTag ?? null, cats),
    );
  }, [open, cats, reasonTag]);

  function submit() {
    const t = title.trim();
    const b = body.trim();
    if (!category) {
      toast.error('분류를 골라 주세요.');
      return;
    }
    if (t.length < 5) {
      toast.error('제목은 5자 이상 입력해 주세요');
      return;
    }
    if (b.length < 10) {
      toast.error('본문은 10자 이상 입력해 주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        const inquiryId = await callRpc(sb, 'submit_inquiry', {
          p_category: category,
          p_title: t,
          p_body: b,
          p_attachments: files.map((f) => f.url) as never,
          p_reason_tag: reasonTag ?? undefined,
        });
        if (typeof inquiryId === 'string') {
          await linkAttachments(files, 'inquiry', inquiryId);
        }
        fetch('/api/hidden-titles/check-inquiry', { method: 'POST' }).catch(() => {});
        toast.success('문의가 접수되었습니다');
        onClose();
        onSuccess();
      } catch (e) {
        toast.error(mapInquiryError(e));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 문의"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button onClick={submit} loading={busy} disabled={!category}>
            접수하기
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">분류</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading || cats.length === 0}
            className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
          >
            {cats.length === 0 && <option value="">{loading ? '불러오는 중…' : '분류 없음'}</option>}
            {cats.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">제목 <span className="text-cdm-fg-muted font-normal">(5~50자)</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="간단한 제목을 입력하세요"
            maxLength={50}
            className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-cdm-fg">본문 <span className="text-cdm-fg-muted font-normal">(10~1000자)</span></label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="자세한 상황을 알려주세요"
            rows={5}
            maxLength={1000}
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
          />
          <p className="text-right text-xs text-cdm-fg-subtle">{body.length} / 1000</p>
        </div>

        <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
      </div>
    </Modal>
  );
}
