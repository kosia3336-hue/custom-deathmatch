'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/cdm/Tabs';
import RankingNicknameSearch from './RankingNicknameSearch';

interface Props {
  games: { id: string; name: string }[];
  activeGame: string | null;
  activePeriod: 'weekly' | 'monthly' | 'all';
}

const PERIODS = [
  { id: 'weekly', label: '주간' },
  { id: 'monthly', label: '월간' },
  { id: 'all', label: '전체' },
];

export default function RankingTabs({ games, activeGame, activePeriod }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(next: { game?: string; period?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const game = next.game !== undefined ? next.game : (activeGame ?? '');
    if (game) params.set('game', game);
    else params.delete('game');
    params.set('period', next.period ?? activePeriod);
    params.delete('page');
    router.replace(`/ranking?${params.toString()}`);
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={activeGame ?? ''}
          onChange={(e) => update({ game: e.target.value })}
          className="h-10 min-w-0 shrink-0 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm font-medium text-cdm-fg focus:outline-none focus:border-cdm-primary"
          aria-label="게임 선택"
        >
          <option value="">전체</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <RankingNicknameSearch />
      </div>
      <Tabs
        tabs={PERIODS}
        value={activePeriod}
        onChange={(id) => update({ period: id })}
      />
    </div>
  );
}
