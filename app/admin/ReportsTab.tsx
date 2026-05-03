import { Card } from '@/components/cdm/Card';
import { ReportStatusChip } from '@/components/cdm/StatusChip';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import { REPORT_CATEGORY_LABELS, REPORT_CONTEXT_LABELS } from '@/lib/report-labels';
import type { ReportStatus, ReportContext, ReportCategory } from '@/lib/supabase/database.types';
import ReportActions from './ReportActions';

interface Row {
  id: string;
  reporter_id: string;
  target_id: string | null;
  category: ReportCategory;
  reason: string;
  context_kind: ReportContext;
  status: ReportStatus;
  created_at: string;
  reporter_snapshot: { nickname?: string };
  target_snapshot: { nickname?: string };
}

export default async function ReportsTab() {
  const sb = await getServerSupabase();
  const res = await sb
    .from('reports')
    .select(
      'id, reporter_id, target_id, category, reason, context_kind, status, created_at, reporter_snapshot, target_snapshot',
    )
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = (res.data ?? []) as unknown as Row[];

  if (rows.length === 0) {
    return <EmptyState title="신고가 없습니다" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <Card key={r.id} className="!p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ReportStatusChip status={r.status} />
              <span className="text-sm font-semibold text-cdm-fg">
                {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
              </span>
              <span className="text-xs text-cdm-fg-muted">
                / {REPORT_CONTEXT_LABELS[r.context_kind] ?? r.context_kind}
              </span>
            </div>
            <span className="text-[11px] text-cdm-fg-subtle">
              {new Date(r.created_at).toLocaleString('ko-KR')}
            </span>
          </div>
          <p className="mt-1 text-xs text-cdm-fg-muted">
            <span className="font-semibold">{r.reporter_snapshot?.nickname ?? '?'}</span> →{' '}
            <span className="font-semibold">{r.target_snapshot?.nickname ?? '?'}</span>
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-cdm-fg">{r.reason}</p>
          {(r.status === 'pending' || r.status === 'processing') && r.target_id && (
            <div className="mt-3">
              <ReportActions reportId={r.id} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
