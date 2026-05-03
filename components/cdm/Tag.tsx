import { cn } from '@/lib/utils';

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

/** 일반 태그 — `#사중력 사목` 같은 분류용. (15번 §15.8.1) */
export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-cdm-bg-elev-2 px-2.5 py-[3px] text-[12px] font-medium text-cdm-fg whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}
