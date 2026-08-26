'use client';

import { Button } from '@/components/cdm/Button';
import type { FourGravityTutorialHint } from '@/shared/types/four-gravity';
import { cn } from '@/lib/utils';

interface Props {
  hint: FourGravityTutorialHint;
  onAck: () => void;
  className?: string;
}

export default function TutorialCoach({ hint, onAck, className }: Props) {
  return (
    <aside
      className={cn(
        'w-full max-w-md rounded-cdm-md border border-cdm-primary bg-cdm-primary-soft px-3 py-2',
        className,
      )}
    >
      <p className="text-[11px] font-bold tracking-wide text-cdm-primary">
        튜토리얼 {hint.step} / {hint.total}
      </p>
      <h2 className="text-sm font-extrabold text-cdm-fg">{hint.title}</h2>
      <div className="mt-0.5 space-y-1 text-sm leading-snug text-cdm-fg-muted">
        {hint.body
          .split(/(?<=[.。])\s*/)
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part, i) => (
            <p key={`${i}-${part}`}>{part}</p>
          ))}
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
