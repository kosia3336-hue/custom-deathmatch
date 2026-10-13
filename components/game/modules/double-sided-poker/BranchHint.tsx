'use client';
import { DoubleSidedPokerBranch } from './presentation';

export function BranchHint({
  branch,
  stake,
}: {
  branch: DoubleSidedPokerBranch;
  stake: number | null;
}) {
  if (branch !== 'both' || stake == null) return null;
  return (
    <p className="ip-branch-hint text-cdm-highlight text-center text-[11px] font-bold">
      양면베팅 — 앞·뒷면에 {stake}칩씩({stake * 2}칩) · 앞뒤가 모두 높아야 이기고, 성공 시 추가 10칩
    </p>
  );
}
