'use client';

export function OpponentPointTracker({
  opponentStage,
  estimate,
  setEstimate,
}: {
  opponentStage: number;
  estimate: number;
  setEstimate: React.Dispatch<React.SetStateAction<number>>;
}) {
  const lo = opponentStage === 0 ? 0 : (opponentStage - 1) * 20 + 1;
  const hi = opponentStage * 20;

  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));

  return (
    <section className="rounded-cdm-lg border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg flex flex-col gap-2 border p-3">
      <p className="text-cdm-fg-muted text-xs font-semibold">상대 잔여 추리</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEstimate((v) => clamp(v - 1))}
          className="border-cdm-border text-cdm-fg bg-cdm-bg hover:bg-cdm-bg-elev-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg font-bold"
        >
          −
        </button>
        <span className="text-cdm-fg flex-1 text-center text-xl font-bold tabular-nums">
          {estimate}p
        </span>
        <button
          onClick={() => setEstimate((v) => clamp(v + 1))}
          className="border-cdm-border text-cdm-fg bg-cdm-bg hover:bg-cdm-bg-elev-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg font-bold"
        >
          +
        </button>
      </div>
    </section>
  );
}
