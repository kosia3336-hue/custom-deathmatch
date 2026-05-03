import { getServerSupabase } from '@/lib/supabase/server';
import type { ReportStatus, InquiryStatus, InquiryCategory } from '@/lib/supabase/database.types';
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
  category: InquiryCategory;
  title: string;
  status: InquiryStatus;
  created_at: string;
  body: string;
  answer_body: string | null;
  answered_at: string | null;
}

export default async function SupportTab({ memberId }: { memberId: string }) {
  const sb = await getServerSupabase();

  const [reportsRes, inquiriesRes] = await Promise.all([
    sb
      .from('reports')
      .select('id, category, status, created_at, resolution_reason')
      .eq('reporter_id', memberId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('inquiries')
      .select('id, category, title, status, created_at, body, answer_body, answered_at')
      .eq('author_id', memberId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const reports = (reportsRes.data ?? []) as unknown as ReportRow[];
  const inquiries = (inquiriesRes.data ?? []) as unknown as InquiryRow[];

  return (
    <SupportTabClient
      inquiries={inquiries as InquiryDetailData[]}
      reports={reports}
    />
  );
}
