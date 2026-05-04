'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/cdm/Card';
import { ReportStatusChip, InquiryStatusChip } from '@/components/cdm/StatusChip';
import { RoutePagination } from '@/components/cdm/Pagination';
import InquiryDetailModal from '@/components/InquiryDetailModal';
import { REPORT_CATEGORY_LABELS } from '@/lib/report-labels';
import type { ReportData, InquiryData } from './types';

const INQUIRY_CATEGORY_LABELS: Record<string, string> = {
  bug: '버그/오류',
  account: '계정/정지',
  rules: '규칙/정책',
  report_followup: '신고 처리 문의',
  etc: '기타',
};

interface Props {
  receivedReports: ReportData[];
  receivedReportsPage: number;
  receivedReportsTotalPages: number;
  receivedReportsTotalCount: number;
  sentReports: ReportData[];
  sentReportsPage: number;
  sentReportsTotalPages: number;
  sentReportsTotalCount: number;
  inquiries: InquiryData[];
  inquiriesPage: number;
  inquiriesTotalPages: number;
  inquiriesTotalCount: number;
}

export default function ReportsSection({
  receivedReports,
  receivedReportsPage,
  receivedReportsTotalPages,
  receivedReportsTotalCount,
  sentReports,
  sentReportsPage,
  sentReportsTotalPages,
  sentReportsTotalCount,
  inquiries,
  inquiriesPage,
  inquiriesTotalPages,
  inquiriesTotalCount,
}: Props) {
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryData | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      {/* 받은 신고 */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          받은 신고 ({receivedReportsTotalCount}건)
          {receivedReportsTotalPages > 1 && (
            <span className="ml-2 text-xs font-normal text-cdm-fg-subtle">
              {receivedReportsPage} / {receivedReportsTotalPages} 페이지
            </span>
          )}
        </h3>
        {receivedReportsTotalCount === 0 ? (
          <p className="text-xs text-cdm-fg-subtle">받은 신고가 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {receivedReports.map((r) => (
                <Card key={r.id} className="!p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cdm-fg-muted">
                        {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
                      </span>
                      <ReportStatusChip status={r.status} />
                      <span className="text-xs text-cdm-fg-muted">신고자: {r.other_nickname}</span>
                    </div>
                    <span className="text-xs text-cdm-fg-subtle">
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
            <RoutePagination
              totalPages={receivedReportsTotalPages}
              paramKey="reportsReceivedPage"
            />
          </>
        )}
      </section>

      {/* 보낸 신고 */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          보낸 신고 ({sentReportsTotalCount}건)
          {sentReportsTotalPages > 1 && (
            <span className="ml-2 text-xs font-normal text-cdm-fg-subtle">
              {sentReportsPage} / {sentReportsTotalPages} 페이지
            </span>
          )}
        </h3>
        {sentReportsTotalCount === 0 ? (
          <p className="text-xs text-cdm-fg-subtle">보낸 신고가 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {sentReports.map((r) => (
                <Card key={r.id} className="!p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cdm-fg-muted">
                        {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
                      </span>
                      <ReportStatusChip status={r.status} />
                      <span className="text-xs text-cdm-fg-muted">대상: {r.other_nickname}</span>
                    </div>
                    <span className="text-xs text-cdm-fg-subtle">
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
            <RoutePagination totalPages={sentReportsTotalPages} paramKey="reportsSentPage" />
          </>
        )}
      </section>

      {/* 보낸 문의 */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          보낸 문의 ({inquiriesTotalCount}건)
          {inquiriesTotalPages > 1 && (
            <span className="ml-2 text-xs font-normal text-cdm-fg-subtle">
              {inquiriesPage} / {inquiriesTotalPages} 페이지
            </span>
          )}
        </h3>
        {inquiriesTotalCount === 0 ? (
          <p className="text-xs text-cdm-fg-subtle">보낸 문의가 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {inquiries.map((i) => (
                <Card
                  key={i.id}
                  className="!p-3 cursor-pointer hover:bg-cdm-bg-elev-2 transition-colors"
                  onClick={() => setSelectedInquiry(i)}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs text-cdm-fg-muted">
                        {INQUIRY_CATEGORY_LABELS[i.category] ?? i.category}
                      </span>
                      <span className="truncate text-sm text-cdm-fg">{i.title}</span>
                      <InquiryStatusChip status={i.status} />
                    </div>
                    <span className="text-xs text-cdm-fg-subtle">
                      {new Date(i.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
            <RoutePagination totalPages={inquiriesTotalPages} paramKey="inquiriesPage" />
          </>
        )}
      </section>

      <InquiryDetailModal
        inquiry={selectedInquiry}
        isAdmin
        onClose={() => setSelectedInquiry(null)}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}
