import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { RoutePagination } from '@/components/cdm/Pagination';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  DEFAULT_PAGE_SIZE,
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { TitleColor } from '@/lib/supabase/database.types';
import CreateTitleForm from './CreateTitleForm';

interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  condition_text: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default async function TitlesTab({ page: pageParam }: { page: string | undefined }) {
  const sb = await getServerSupabase();
  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);

  const res = await sb
    .from('titles')
    .select('id, name, color, description, condition_text, is_system, is_active, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);
  const titles = (res.data ?? []) as unknown as TitleRow[];
  const totalCount = res.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-cdm-fg">새 칭호 생성</h2>
        <CreateTitleForm />
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          전체 칭호 ({totalCount})
          {totalPages > 1 && (
            <span className="ml-2 text-xs font-normal text-cdm-fg-subtle">
              {page} / {totalPages} 페이지
            </span>
          )}
        </h2>
        <div className="flex flex-col gap-2">
          {titles.map((t) => (
            <Link key={t.id} href={`/admin/titles/${t.id}`}>
              <Card className="!p-3 hover:bg-cdm-bg-elev-1 transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <TitleBadge name={t.name} color={t.color} size="md" />
                    {t.is_system && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-cdm-border px-2 py-px text-[10px] font-semibold text-cdm-fg-muted"
                        title="히든 시스템 칭호 — 조건은 서버 코드에서 관리"
                      >
                        🔒 시스템
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="text-[11px] text-cdm-fg-muted">비활성</span>
                    )}
                  </div>
                  <span className="text-xs text-cdm-fg-subtle">보유자 보기 →</span>
                </div>
                {t.description && (
                  <p className="mt-1 text-xs text-cdm-fg-muted">{t.description}</p>
                )}
                {t.condition_text && (
                  <p className="mt-0.5 text-xs text-cdm-fg-subtle">
                    조건: {t.condition_text}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
        <RoutePagination totalPages={totalPages} />
      </div>
    </div>
  );
}
