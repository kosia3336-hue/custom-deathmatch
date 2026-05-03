import { formatTimeLimitShort } from '@/lib/utils';

interface Props {
  seconds: number;
}

export default function TimeLimitBadge({ seconds }: Props) {
  return (
    <span className="inline-flex items-center rounded-cdm-sm border border-cdm-highlight-soft bg-cdm-highlight-soft px-1.5 py-0.5 text-[10px] font-medium text-[#a16207]">
      ⏱{formatTimeLimitShort(seconds)}
    </span>
  );
}
