'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { Button } from './Button';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { ReportCategory, ReportContext } from '@/lib/supabase/database.types';
import { AttachmentPicker, linkAttachments, type AttachedFile } from '@/components/support/AttachmentPicker';

const CATEGORIES: { id: ReportCategory; label: string; desc: string }[] = [
  { id: 'abuse', label: '욕설/혐오', desc: '욕설, 혐오 발언, 차별' },
  { id: 'spam', label: '도배/광고', desc: '반복 메시지, 외부 광고' },
  { id: 'cheat', label: '비매너/속임수', desc: '의도적 시간 끌기, 부정행위' },
  { id: 'bad_manner', label: '비매너', desc: '경기 매너 위반' },
  { id: 'improper_nickname', label: '부적절한 닉네임', desc: '욕설/사칭 닉네임' },
  { id: 'etc', label: '기타', desc: '위에 해당하지 않는 사유' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** 피신고자 회원 ID (필수). AI/탈퇴 회원은 신고 불가 */
  targetId: string | null;
  targetNickname?: string;
  context: ReportContext;
  contextData?: Record<string, unknown>;
}

export function ReportModal({
  open,
  onClose,
  targetId,
  targetNickname,
  context,
  contextData,
}: Props) {
  const [category, setCategory] = useState<ReportCategory>('abuse');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [busy, startTransition] = useTransition();

  function submit() {
    const r = reason.trim();
    if (!targetId) {
      toast.error('이 사용자는 신고할 수 없습니다 (AI/탈퇴 회원)');
      return;
    }
    if (r.length < 10) {
      toast.error('사유는 10자 이상 입력해 주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        const reportId = await callRpc(sb, 'submit_report', {
          p_target_id: targetId,
          p_category: category,
          p_reason: r,
          p_context_kind: context,
          p_context_data: (contextData ?? {}) as Record<string, unknown> as never,
        });
        if (typeof reportId === 'string') {
          await linkAttachments(files, 'report', reportId);
        }
        toast.success('신고가 접수되었습니다');
        setReason('');
        setFiles([]);
        onClose();
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === '23514') {
          toast.error('24시간 내 신고가 너무 많습니다');
        } else {
          toast.error(`신고 실패: ${(e as Error).message}`);
        }
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={targetNickname ? `${targetNickname} 신고` : '사용자 신고'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            신고 접수
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-cdm-fg-muted">
        부적절한 행동을 했나요? 신고 내용은 운영진에게만 전달되며, 피신고자에게는 공개되지 않습니다.
      </p>

      <div className="mb-3">
        <label className="mb-2 block text-sm font-medium text-cdm-fg">분류</label>
        <div className="flex flex-col gap-1.5">
          {CATEGORIES.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-start gap-2 rounded-cdm-md border p-2 ${
                category === c.id
                  ? 'border-cdm-primary bg-cdm-primary-soft/40'
                  : 'border-cdm-border'
              }`}
            >
              <input
                type="radio"
                name="report-category"
                value={c.id}
                checked={category === c.id}
                onChange={() => setCategory(c.id)}
                className="mt-0.5 accent-cdm-primary"
              />
              <span>
                <span className="block text-sm font-semibold text-cdm-fg">{c.label}</span>
                <span className="block text-xs text-cdm-fg-muted">{c.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-cdm-fg">자세한 사유</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유를 자세히 적어주세요 (10~500자)"
          rows={4}
          maxLength={500}
          className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary focus:[box-shadow:var(--cdm-ring-primary)]"
        />

        <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
        <p className="mt-1 text-xs text-cdm-fg-muted">{reason.length} / 500</p>
      </div>
    </Modal>
  );
}
