'use client';

import { useRouter } from 'next/navigation';

interface Season {
  id: number;
  name: string;
  is_active: boolean;
}

export default function RankSeasonSelect({
  seasons,
  selectedSeasonId,
}: {
  seasons: Season[];
  selectedSeasonId: number;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedSeasonId}
      onChange={(e) => router.replace(`/me?tab=rank&rankSeason=${e.target.value}`)}
      className="rounded-md border border-cdm-border bg-cdm-bg-elev-2 px-2 py-1 text-sm text-cdm-fg focus:outline-none focus:ring-1 focus:ring-cdm-primary"
    >
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.is_active ? ' (현재)' : ''}
        </option>
      ))}
    </select>
  );
}
