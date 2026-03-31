import { formatTimeLimitShort } from '@/lib/utils';

interface Props {
  seconds: number;
}

export default function TimeLimitBadge({ seconds }: Props) {
  return (
    <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      ⏱{formatTimeLimitShort(seconds)}
    </span>
  );
}
