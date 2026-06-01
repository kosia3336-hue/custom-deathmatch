'use client';

import { useState } from 'react';
import { PublicTitleCard } from '@/components/cdm/PublicTitleCard';
import { TitleDetailModal } from '@/components/TitleDetailModal';
import { Pagination } from '@/components/cdm/Pagination';
import type { TitleColor } from '@/lib/supabase/database.types';

const PAGE_SIZE = 18;

type FilterKind = 'all' | 'normal' | 'hidden' | 'shop' | 'legend';

const FILTER_LABELS: Record<FilterKind, string> = {
  all: '전체',
  normal: '일반',
  hidden: '히든',
  shop: '상점',
  legend: '레전드',
};

interface PublicTitle {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  condition_text: string | null;
  is_system: boolean;
  is_legend: boolean;
  effect: string | null;
  holder_count: number;
  first_granted_at: string | null;
}

interface Props {
  titles: PublicTitle[];
  shopTitleIds: string[];
}

export default function TitlesClient({ titles, shopTitleIds }: Props) {
  const shopSet = new Set(shopTitleIds);
  const [selected, setSelected] = useState<PublicTitle | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterKind>('all');

  function applyFilter(t: PublicTitle): boolean {
    if (filter === 'all') return true;
    if (filter === 'legend') return t.is_legend;
    if (filter === 'hidden') return t.is_system && !t.is_legend;
    if (filter === 'shop') return shopSet.has(t.id) && !t.is_legend;
    // normal: not hidden, not shop, not legend
    return !t.is_system && !t.is_legend && !shopSet.has(t.id);
  }

  const filtered = titles.filter(applyFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleFilterChange(next: FilterKind) {
    setFilter(next);
    setCurrentPage(1);
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filterKeys: FilterKind[] = ['all', 'normal', 'hidden', 'shop', 'legend'];

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {filterKeys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => handleFilterChange(k)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === k
                ? 'bg-cdm-primary text-white'
                : 'bg-cdm-surface-raised text-cdm-fg-muted hover:text-cdm-fg',
            ].join(' ')}
          >
            {FILTER_LABELS[k]}
          </button>
        ))}
      </div>

      {paged.length === 0 ? (
        <p className="py-12 text-center text-sm text-cdm-fg-muted">
          해당하는 칭호가 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((t) => (
            <PublicTitleCard
              key={t.id}
              name={t.name}
              color={t.color}
              effect={t.effect}
              description={t.description}
              holderCount={t.holder_count}
              isSystem={t.is_system}
              isLegend={t.is_legend}
              purchasable={shopSet.has(t.id)}
              onClick={() => setSelected(t)}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        className="mt-6"
      />

      <TitleDetailModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        titleId={selected?.id ?? null}
        titleName={selected?.name ?? ''}
        titleColor={selected?.color ?? 'indigo'}
        titleEffect={selected?.effect ?? null}
        description={selected?.description ?? null}
        conditionText={selected?.condition_text ?? null}
        isSystem={selected?.is_system ?? false}
        holderCount={selected?.holder_count ?? 0}
      />
    </>
  );
}
