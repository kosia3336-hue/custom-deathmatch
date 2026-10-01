import { Icon } from '@/components/cdm/Icon';
import { formatTimeLimitShort } from '@/lib/utils';

interface Props {
  seconds: number;
}

export default function TimeLimitBadge({ seconds }: Props) {
  const label = formatTimeLimitShort(seconds);
  return (
    <span
      title={`턴 시간 제한 ${label}`}
      className="inline-flex items-center gap-0.5 rounded-cdm-sm border border-cdm-highlight-soft bg-cdm-highlight-soft px-1.5 py-0.5 text-[10px] font-medium text-[#a16207]"
    >
      <Icon name="timer" size="sm" className="h-3 w-3" />
      {label}
    </span>
  );
}
