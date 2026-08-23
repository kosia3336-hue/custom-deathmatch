'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/cdm/Tabs';

export interface SeasonOption {
  id: number;
  name: string;
  is_active: boolean | null;
}

export type RankingBoard = 'game' | 'rank';

interface Props {
  board: RankingBoard;
  seasons: SeasonOption[];
  /** URL에 season 없을 때 선택값 (서버에서 진행 중 시즌 등) */
  defaultSeasonId: number | null;
}

export default function RankingBoardTabs({ board, seasons, defaultSeasonId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setBoard(next: RankingBoard) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('board', next);
    if (next === 'game') {
      p.delete('season');
      p.delete('tier');
    } else {
      p.delete('game');
      p.delete('period');
    }
    p.delete('page');
    router.replace(`${pathname}?${p.toString()}`);
  }

  function setTier(value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set('tier', value);
    else p.delete('tier');
    p.delete('page');
    router.replace(`${pathname}?${p.toString()}`);
  }

  function setSeason(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('board', 'rank');
    p.set('season', id);
    p.delete('page');
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="mb-4 space-y-3">
      <Tabs
        tabs={[
          { id: 'rank', label: '랭크' },
          { id: 'game', label: '게임 랭킹' },
        ]}
        value={board}
        onChange={(id) => setBoard(id as RankingBoard)}
      />
      {board === 'rank' && seasons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="rank-season"
            value={
              searchParams.get('season')
              ?? (defaultSeasonId != null ? String(defaultSeasonId) : '')
            }
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg"
          >
            {seasons.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
                {s.is_active ? ' (진행 중)' : ''}
              </option>
            ))}
          </select>
          <select
            value={searchParams.get('tier') ?? ''}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg"
          >
            <option value="">전체 티어</option>
            <option value="challenger">챌린저</option>
            <option value="diamond">다이아</option>
            <option value="gold">골드</option>
            <option value="silver">실버</option>
            <option value="bronze">브론즈</option>
            <option value="unranked">언랭</option>
          </select>
        </div>
      )}
    </div>
  );
}
