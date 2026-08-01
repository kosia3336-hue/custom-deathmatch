'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { InquiryStatusChip } from '@/components/cdm/StatusChip';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { InquiryStatus, InquiryCategory } from '@/lib/supabase/database.types';

export interface InquiryDetailData {
  id: string;
  title: string;
  category: InquiryCategory;
  status: InquiryStatus;
  created_at: string;
  body: string;
  answer_body: string | null;
  answered_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: '버그/오류',
  account: '계정/정지',
  rules: '규칙/정책',
  report_followup: '신고 처리 문의',
  etc: '기타',
};

interface Props {
  inquiry: InquiryDetailData | null;
  isAdmin?: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function InquiryDetailModal({ inquiry, isAdmin = false, onClose, onRefresh }: Props) {
  const [answerText, setAnswerText] = useState('');
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (inquiry) setAnswerText('');
  }, [inquiry?.id]);

  function submitAnswer() {
    if (answerText.trim().length < 5) {
      toast.error('답변은 5자 이상 입력해 주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_answer_inquiry', {
          p_id: inquiry!.id,
          p_body: answerText.trim(),
        });
        toast.success('답변이 등록되었습니다');
        onClose();
        onRefresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  const isAnswered = !!inquiry?.answer_body;

  return (
    <Modal
      open={!!inquiry}
      onClose={onClose}
      size="md"
      title={
        inquiry ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-cdm-fg-muted">{CATEGORY_LABELS[inquiry.category] ?? inquiry.category}</span>
            <InquiryStatusChip status={inquiry.status} />
          </div>
        ) : null
      }
    >
      {inquiry && (
        <div className="flex flex-col gap-4">
          {/* 제목 + 날짜 */}
          <div>
            <p className="font-semibold text-cdm-fg">{inquiry.title}</p>
            <p className="mt-0.5 text-xs text-cdm-fg-subtle">
              {new Date(inquiry.created_at).toLocaleString('ko-KR')}
            </p>
          </div>

          {/* 문의 내용 */}
          <div className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cdm-fg-subtle">문의 내용</p>
            <p className="whitespace-pre-wrap text-sm text-cdm-fg">{inquiry.body}</p>
          </div>

          {/* 운영 답변 */}
          {isAnswered ? (
            <div className="rounded-cdm-md border border-cdm-primary/30 bg-cdm-primary/5 px-3 py-2.5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cdm-primary">
                운영 답변 · {new Date(inquiry.answered_at!).toLocaleString('ko-KR')}
              </p>
              <p className="whitespace-pre-wrap text-sm text-cdm-fg">{inquiry.answer_body}</p>
            </div>
          ) : !isAdmin ? (
            <p className="text-xs text-cdm-fg-subtle">답변을 기다리고 있습니다.</p>
          ) : null}

          {/* 관리자: 답변 입력 */}
          {isAdmin && !isAnswered && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-cdm-fg">답변 작성</p>
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={4}
                placeholder="답변 내용을 입력하세요 (5자 이상)"
                className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={submitAnswer} loading={busy}>
                  답변 등록
                </Button>
              </div>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
}
