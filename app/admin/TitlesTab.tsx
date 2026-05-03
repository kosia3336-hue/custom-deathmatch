import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getServerSupabase } from '@/lib/supabase/server';
import type { TitleColor } from '@/lib/supabase/database.types';
import CreateTitleForm from './CreateTitleForm';

interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default async function TitlesTab() {
  const sb = await getServerSupabase();
  const res = await sb
    .from('titles')
    .select('id, name, color, description, is_active, created_at')
    .order('created_at', { ascending: false });
  const titles = (res.data ?? []) as unknown as TitleRow[];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-cdm-fg">새 칭호 생성</h2>
        <CreateTitleForm />
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          전체 칭호 ({titles.length})
        </h2>
        <div className="flex flex-col gap-2">
          {titles.map((t) => (
            <Link key={t.id} href={`/admin/titles/${t.id}`}>
              <Card className="!p-3 hover:bg-cdm-bg-elev-1 transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <TitleBadge name={t.name} color={t.color} size="md" />
                    {!t.is_active && (
                      <span className="text-[11px] text-cdm-fg-muted">비활성</span>
                    )}
                  </div>
                  <span className="text-xs text-cdm-fg-subtle">보유자 보기 →</span>
                </div>
                {t.description && (
                  <p className="mt-1 text-xs text-cdm-fg-muted">{t.description}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
