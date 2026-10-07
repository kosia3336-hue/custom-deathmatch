'use client';
import { cn } from '@/lib/utils';
import { BRANCH_LABEL, DoubleSidedPokerBranch } from './presentation';

export function BranchPicker({
  value,
  onChange,
  doubleEnabled,
  locked,
}: {
  value: DoubleSidedPokerBranch;
  onChange: (branch: DoubleSidedPokerBranch) => void;
  doubleEnabled: boolean;
  locked: boolean;
}) {
  if (locked) {
    return (
      <p className="text-cdm-fg-muted mb-2 text-center text-[11px] font-bold">
        이번 라운드 선택 —{' '}
        <span className="text-cdm-highlight font-black">{BRANCH_LABEL[value].slice(0, 2)}</span>
      </p>
    );
  }
  return (
    <div className="border-cdm-border bg-cdm-bg-elev-1 mb-2 grid grid-cols-3 gap-1 rounded-lg border p-0.5">
      {(['front', 'back', 'both'] as const).map((branch) => {
        const disabled = branch === 'both' && !doubleEnabled;
        return (
          <button
            key={branch}
            type="button"
            disabled={disabled}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-black transition',
              value === branch
                ? 'bg-cdm-primary text-white'
                : disabled
                  ? 'text-cdm-fg-subtle cursor-not-allowed'
                  : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-2',
            )}
            onClick={() => onChange(branch)}
          >
            {BRANCH_LABEL[branch]}
          </button>
        );
      })}
    </div>
  );
}
