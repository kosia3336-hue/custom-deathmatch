'use client';

export function GamePlayerScoreboard({
  entries,
  myId,
}: {
  entries: Array<{
    id: string;
    nickname: string;
    value: string | number;
    detail?: string;
    active?: boolean;
  }>;
  myId: string;
}) {
  const ordered = [...entries].sort((a, b) => Number(b.id === myId) - Number(a.id === myId));
  return (
    <div className="grid grid-cols-2 gap-2">
      {ordered.map((entry) => (
        <div
          key={entry.id}
          data-score-row
          className={`min-w-0 rounded-lg border p-2 ${entry.active ? 'border-cdm-primary bg-cdm-primary-soft' : 'border-cdm-border bg-cdm-bg'}`}
        >
          <p className="text-cdm-fg truncate text-xs font-semibold">
            {entry.nickname}
            {entry.id === myId && ' (나)'}
          </p>
          <p className="text-cdm-fg text-sm font-bold tabular-nums">{entry.value}</p>
          {entry.detail && <p className="text-cdm-fg-muted text-[11px]">{entry.detail}</p>}
        </div>
      ))}
    </div>
  );
}
