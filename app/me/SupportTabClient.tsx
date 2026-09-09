'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { EmptyState } from '@/components/cdm/EmptyState';
import { ReportStatusChip, InquiryStatusChip } from '@/components/cdm/StatusChip';
import { RoutePagination } from '@/components/cdm/Pagination';
import InquiryDetailModal, { type InquiryDetailData } from '@/components/InquiryDetailModal';
import InquirySubmitModal from '@/components/InquirySubmitModal';
import { REPORT_CATEGORY_LABELS } from '@/lib/report-labels';
import type { ReportStatus } from '@/lib/supabase/database.types';

interface ReportRow {
  id: string;
  category: string;
  status: ReportStatus;
  created_at: string;
  resolution_reason: string | null;
}

interface Props {
  inquiries: InquiryDetailData[];
  inquiriesPage: number;
  inquiriesTotalPages: number;
  inquiriesTotalCount: number;
  reports: ReportRow[];
  reportsPage: number;
  reportsTotalPages: number;
  reportsTotalCount: number;
}

export default function SupportTabClient({
  inquiries,
  inquiriesPage,
  inquiriesTotalPages,
  inquiriesTotalCount,
  reports,
  reportsPage,
  reportsTotalPages,
  reportsTotalCount,
}: Props) {
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryDetailData | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      {/* 내 문의 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cdm-fg">
            내 문의 ({inquiriesTotalCount})
            {inquiriesTotalPages > 1 && (
              <span className="ml-2 text-xs font-normal text-cdm-fg-muted">
                {inquiriesPage} / {inquiriesTotalPages} 페이지
              </span>
            )}
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setSubmitOpen(true)}>
            + 새 문의
          </Button>
        </div>
        {inquiriesTotalCount === 0 ? (
          <EmptyState title="보낸 문의가 없습니다" />
        ) : (
          <>
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
                    {q.category_label ?? q.category} ·{' '}
                    {new Date(q.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </Card>
              ))}
            </div>
            <RoutePagination totalPages={inquiriesTotalPages} paramKey="inquiriesPage" />
          </>
        )}
      </section>

      {/* 내 신고 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg">
          내 신고 ({reportsTotalCount})
          {reportsTotalPages > 1 && (
            <span className="ml-2 text-xs font-normal text-cdm-fg-muted">
              {reportsPage} / {reportsTotalPages} 페이지
            </span>
          )}
        </h2>
        {reportsTotalCount === 0 ? (
          <EmptyState title="보낸 신고가 없습니다" />
        ) : (
          <>
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
            <RoutePagination totalPages={reportsTotalPages} paramKey="reportsPage" />
          </>
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
