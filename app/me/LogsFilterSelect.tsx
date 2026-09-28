'use client';

import { useRouter } from 'next/navigation';
import type { LogOpponentFilter } from './logOpponent';

const SELECT_CLASS =
  'rounded-md border border-cdm-border bg-cdm-bg-elev-2 px-2 py-1 text-sm text-cdm-fg focus:outline-none focus:ring-1 focus:ring-cdm-primary';

const OPPONENT_OPTIONS: { value: LogOpponentFilter; label: string }[] = [
  { value: 'all', label: '상대' },
  { value: 'user', label: '유저' },
  { value: 'ai', label: 'AI' },
];

export interface LogGameOption {
  id: string;
  name: string;
}

export default function LogsFilterSelect({
  opponent,
  gameId,
  games,
}: {
  opponent: LogOpponentFilter;
  gameId: string;
  games: LogGameOption[];
}) {
  const router = useRouter();

  function go(patch: { logOpponent?: string; logGame?: string }) {
    const nextOpponent = patch.logOpponent ?? opponent;
    const nextGame = patch.logGame ?? gameId;
    const params = new URLSearchParams({ tab: 'logs' });
    if (nextOpponent !== 'all') params.set('logOpponent', nextOpponent);
    if (nextGame !== 'all') params.set('logGame', nextGame);
    router.replace(`/me?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={opponent}
        aria-label="상대"
        onChange={(e) => go({ logOpponent: e.target.value })}
        className={SELECT_CLASS}
      >
        {OPPONENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        value={gameId}
        aria-label="종목"
        onChange={(e) => go({ logGame: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="all">종목</option>
        {games.map((game) => (
          <option key={game.id} value={game.id}>
            {game.name}
          </option>
        ))}
      </select>
    </div>
  );
}
