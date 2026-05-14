'use client';

import { useState } from 'react';
import { PublicTitleCard } from '@/components/cdm/PublicTitleCard';
import { TitleDetailModal } from '@/components/TitleDetailModal';
import { Pagination } from '@/components/cdm/Pagination';
import type { TitleColor } from '@/lib/supabase/database.types';

const PAGE_SIZE = 18;

interface PublicTitle {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  condition_text: string | null;
  is_system: boolean;
  holder_count: number;
  first_granted_at: string | null;
}

interface Props {
  titles: PublicTitle[];
  purchasableIds: string[];
}

export default function TitlesClient({ titles, purchasableIds }: Props) {
  const purchasableSet = new Set(purchasableIds);
  const [selected, setSelected] = useState<PublicTitle | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(titles.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paged = titles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {paged.map((t) => (
          <PublicTitleCard
            key={t.id}
            name={t.name}
            color={t.color}
            description={t.description}
            holderCount={t.holder_count}
            isSystem={t.is_system}
            purchasable={purchasableSet.has(t.id)}
            onClick={() => setSelected(t)}
          />
        ))}
      </div>

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
        description={selected?.description ?? null}
        conditionText={selected?.condition_text ?? null}
        isSystem={selected?.is_system ?? false}
        holderCount={selected?.holder_count ?? 0}
      />
    </>
  );
}
