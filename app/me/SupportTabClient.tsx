'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { EmptyState } from '@/components/cdm/EmptyState';
import { ReportStatusChip, InquiryStatusChip } from '@/components/cdm/StatusChip';
import InquiryDetailModal, { type InquiryDetailData } from '@/components/InquiryDetailModal';
import InquirySubmitModal from '@/components/InquirySubmitModal';
import { REPORT_CATEGORY_LABELS } from '@/lib/report-labels';
import type { ReportStatus } from '@/lib/supabase/database.types';

const INQUIRY_CATEGORY_LABELS: Record<string, string> = {
  bug: '버그/오류',
  account: '계정/정지',
  rules: '규칙/정책',
  report_followup: '신고 처리 문의',
  etc: '기타',
};

interface ReportRow {
  id: string;
  category: string;
  status: ReportStatus;
  created_at: string;
  resolution_reason: string | null;
}

interface Props {
  inquiries: InquiryDetailData[];
  reports: ReportRow[];
}

export default function SupportTabClient({ inquiries, reports }: Props) {
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryDetailData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      {/* 내 문의 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cdm-fg">내 문의 ({inquiries.length})</h2>
          <Button variant="secondary" size="sm" onClick={() => setSubmitOpen(true)}>
            + 새 문의
          </Button>
        </div>
        {inquiries.length === 0 ? (
          <EmptyState title="보낸 문의가 없어요" />
        ) : (
          <div className="flex flex-col gap-2">
            {inquiries.map((q) => (
              <Card
                key={q.id}
                className="!p-3 cursor-pointer hover:bg-cdm-bg-elev-2 transition-colors"
                onClick={() => setSelectedInquiry(q)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-cdm-fg">{q.title}</span>
                  <InquiryStatusChip status={q.status} />
                </div>
                <p className="mt-1 text-xs text-cdm-fg-muted">
                  {INQUIRY_CATEGORY_LABELS[q.category] ?? q.category} ·{' '}
                  {new Date(q.created_at).toLocaleDateString('ko-KR')}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 내 신고 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg">내 신고 ({reports.length})</h2>
        {reports.length === 0 ? (
          <EmptyState title="보낸 신고가 없어요" />
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r) => (
              <Card key={r.id} className="!p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-cdm-fg">
                    {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  <ReportStatusChip status={r.status} />
                </div>
                <p className="mt-1 text-xs text-cdm-fg-muted">
                  {new Date(r.created_at).toLocaleString('ko-KR')}
                </p>
                {r.resolution_reason && (
                  <p className="mt-1 text-xs text-cdm-fg">처리 결과: {r.resolution_reason}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <InquiryDetailModal
        inquiry={selectedInquiry}
        isAdmin={false}
        onClose={() => setSelectedInquiry(null)}
        onRefresh={() => router.refresh()}
      />

      <InquirySubmitModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
