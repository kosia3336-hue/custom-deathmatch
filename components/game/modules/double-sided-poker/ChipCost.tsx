'use client';

export function ChipCost({ total, perSide }: { total: number; perSide: number | null }) {
  return (
    <span className="text-cdm-fg text-base font-black tabular-nums">
      {total}
      {perSide != null && perSide > 0 && (
        <span className="text-cdm-fg-muted ml-0.5 text-xs font-bold">(2×{perSide})</span>
      )}
    </span>
  );
}
