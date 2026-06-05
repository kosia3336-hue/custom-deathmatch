import type { IneligibleReason } from '@/lib/gacha/types';

const LABEL: Record<IneligibleReason, string> = {
  permanent_owned: '영구 보유',
  already_owned: '보유 중',
  global_claimed: '획득 완료',
};

export default function GachaIneligibleBadge({ reason }: { reason: IneligibleReason }) {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-cdm-border bg-cdm-bg-elev-1 px-1.5 py-px text-[10px] font-medium text-cdm-fg-muted">
      {LABEL[reason]}
    </span>
  );
}
