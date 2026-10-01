import { getServerSupabase } from '@/lib/supabase/server';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { ReportStatus, InquiryStatus } from '@/lib/supabase/database.types';
import { fetchInquiryCategories, inquiryCategoryLabel } from '@/lib/inquiry/categories';
import SupportTabClient from './SupportTabClient';
import type { InquiryDetailData } from '@/components/InquiryDetailModal';

interface ReportRow {
  id: string;
  category: string;
  status: ReportStatus;
  created_at: string;
  resolution_reason: string | null;
}

interface InquiryRow {
  id: string;
  category: string;
  title: string;
  status: InquiryStatus;
  created_at: string;
  body: string;
  answer_body: string | null;
  answered_at: string | null;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function SupportTab({
  memberId,
  inquiriesPage: inquiriesPageParam,
  reportsPage: reportsPageParam,
}: {
  memberId: string;
  inquiriesPage?: string;
  reportsPage?: string;
}) {
  const sb = await getServerSupabase();

  const inquiriesPage = parsePageParam(inquiriesPageParam);
  const reportsPage = parsePageParam(reportsPageParam);

  const inquiriesRange = getRange(inquiriesPage, PAGE_SIZE);
  const reportsRange = getRange(reportsPage, PAGE_SIZE);

  const [reportsRes, inquiriesRes, inquiryCats] = await Promise.all([
    sb
      .from('reports')
      .select('id, category, status, created_at, resolution_reason', { count: 'exact' })
      .eq('reporter_id', memberId)
      .order('created_at', { ascending: false })
      .range(reportsRange.from, reportsRange.to),
    sb
      .from('inquiries')
      .select('id, category, title, status, created_at, body, answer_body, answered_at', {
        count: 'exact',
      })
      .eq('author_id', memberId)
      .order('created_at', { ascending: false })
      .range(inquiriesRange.from, inquiriesRange.to),
    fetchInquiryCategories(sb),
  ]);

  const reports = (reportsRes.data ?? []) as unknown as ReportRow[];
  const inquiries = ((inquiriesRes.data ?? []) as unknown as InquiryRow[]).map((q) => ({
    ...q,
    category_label: inquiryCategoryLabel(q.category, inquiryCats),
  }));
  const reportsTotal = reportsRes.count ?? 0;
  const inquiriesTotal = inquiriesRes.count ?? 0;

  return (
    <SupportTabClient
      inquiries={inquiries as InquiryDetailData[]}
      inquiriesPage={inquiriesPage}
      inquiriesTotalPages={getTotalPages(inquiriesTotal, PAGE_SIZE)}
      inquiriesTotalCount={inquiriesTotal}
      reports={reports}
      reportsPage={reportsPage}
      reportsTotalPages={getTotalPages(reportsTotal, PAGE_SIZE)}
      reportsTotalCount={reportsTotal}
    />
  );
}
