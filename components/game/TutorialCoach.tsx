'use client';

import { Button } from '@/components/cdm/Button';
export interface TutorialCoachHint {
  step: number;
  total: number;
  title: string;
  body: string;
  canAck: boolean;
  ackLabel: string;
}
import { cn } from '@/lib/utils';

interface Props {
  hint: TutorialCoachHint;
  onAck: () => void;
  className?: string;
  compact?: boolean;
}

export default function TutorialCoach({ hint, onAck, className, compact = false }: Props) {
  return (
    <aside
      className={cn(
        'rounded-cdm-md border-cdm-primary bg-cdm-primary-soft w-full max-w-md border px-3 py-2',
        className,
      )}
    >
      <p className="text-cdm-primary text-[11px] font-bold tracking-wide">
        튜토리얼 {hint.step} / {hint.total}
      </p>
      <h2 className="text-cdm-fg text-sm font-extrabold">{hint.title}</h2>
      <div
        className={cn(
          'text-cdm-fg-muted mt-0.5',
          compact ? 'text-xs leading-4' : 'space-y-1 text-sm leading-snug',
        )}
      >
        {compact ? (
          <p>{hint.body}</p>
        ) : (
          hint.body
            .split(/(?<=[.。])\s*/)
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part, i) => <p key={`${i}-${part}`}>{part}</p>)
        )}
      </div>
      {hint.canAck && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={onAck}>
            {hint.ackLabel}
          </Button>
        </div>
      )}
    </aside>
  );
}
