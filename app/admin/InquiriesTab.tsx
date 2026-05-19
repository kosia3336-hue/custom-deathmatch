import { Card } from '@/components/cdm/Card';
import { InquiryStatusChip } from '@/components/cdm/StatusChip';
import { EmptyState } from '@/components/cdm/EmptyState';
import { RoutePagination } from '@/components/cdm/Pagination';
import { getServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_PAGE_SIZE, getRange, getTotalPages, parsePageParam } from '@/lib/pagination';
import type { InquiryStatus, InquiryCategory } from '@/lib/supabase/database.types';
import InquiryAnswerForm from './InquiryAnswerForm';
import InquiriesFilterClient, { type InquiryStatusFilter } from './InquiriesFilterClient';

interface Row {
  id: string;
  author_id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  status: InquiryStatus;
  reason_tag: string | null;
  answer_body: string | null;
  reply_body: string | null;
  created_at: string;
  answered_at: string | null;
}

interface AuthorRow {
  id: string;
  nickname: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  bug: '버그',
  account: '계정',
  rules: '규정',
  report_followup: '신고 후속',
  etc: '기타',
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const PENDING_STATUSES: InquiryStatus[] = ['pending', 'processing'];
const DONE_STATUSES: InquiryStatus[] = ['answered', 'replied', 'closed'];

function parseStatusFilter(raw: string | undefined): InquiryStatusFilter {
  if (raw === 'pending' || raw === 'done') return raw;
  return 'all';
}

export default async function InquiriesTab({
  page: pageParam,
  statusFilter: statusFilterRaw,
}: {
  page: string | undefined;
  statusFilter: string | undefined;
}) {
  const sb = await getServerSupabase();
  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);
  const statusFilter = parseStatusFilter(statusFilterRaw);

  let q = sb
    .from('inquiries')
    .select(
      'id, author_id, category, title, body, status, reason_tag, answer_body, reply_body, created_at, answered_at',
      { count: 'exact' },
    );
  if (statusFilter === 'pending') q = q.in('status', PENDING_STATUSES);
  else if (statusFilter === 'done') q = q.in('status', DONE_STATUSES);

  const res = await q.order('created_at', { ascending: false }).range(from, to);
  const rows = (res.data ?? []) as unknown as Row[];
  const totalCount = res.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const authorsRes = authorIds.length
    ? await sb.from('members').select('id, nickname').in('id', authorIds)
    : { data: [] };
  const authors = (authorsRes.data ?? []) as unknown as AuthorRow[];
  const nameOf = (id: string) => authors.find((a) => a.id === id)?.nickname ?? id.slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <InquiriesFilterClient current={statusFilter} />
        <p className="text-xs text-cdm-fg-muted">
          총 {totalCount}건 · {page} / {totalPages} 페이지
        </p>
      </div>
      {totalCount === 0 && <EmptyState title="문의가 없습니다" />}
      {rows.map((q) => (
        <Card key={q.id} className="!p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <InquiryStatusChip status={q.status} />
              <span className="text-[11px] rounded px-1.5 py-0.5 bg-cdm-bg-elev-2 text-cdm-fg-muted font-medium shrink-0">
                {CATEGORY_LABEL[q.category] ?? q.category}
              </span>
              <span className="text-sm font-semibold text-cdm-fg truncate">{q.title}</span>
              {q.reason_tag && (
                <span className="text-[11px] text-cdm-accent">[{q.reason_tag}]</span>
              )}
            </div>
            <span className="text-[11px] text-cdm-fg-subtle">
              {new Date(q.created_at).toLocaleString('ko-KR')} · {nameOf(q.author_id)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-cdm-fg">{q.body}</p>
          {q.answer_body && (
            <div className="mt-2 rounded-cdm-md bg-cdm-success-soft p-2">
              <p className="text-[11px] font-bold text-[#15803d]">답변</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#15803d]">{q.answer_body}</p>
            </div>
          )}
          {q.reply_body && (
            <div className="mt-2 rounded-cdm-md bg-cdm-info-soft p-2">
              <p className="text-[11px] font-bold text-[#1d4ed8]">회원 추가 회신</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d4ed8]">{q.reply_body}</p>
            </div>
          )}
          {!q.answer_body && (
            <div className="mt-3">
              <InquiryAnswerForm inquiryId={q.id} />
            </div>
          )}
        </Card>
      ))}
      <RoutePagination totalPages={totalPages} />
    </div>
  );
}
