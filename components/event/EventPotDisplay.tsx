'use client';

import { cn } from '@/lib/utils';
import type { IPEPhase } from '@/shared/types';

interface Props {
  pot: number;
  communityCards: [number, number] | null;
  phase: IPEPhase;
}

export default function EventPotDisplay({ pot, communityCards, phase }: Props) {
  return (
    <div className="my-1 flex flex-col items-center justify-center gap-2 rounded-cdm-md bg-cdm-bg-elev-2 p-3 sm:p-4">
      <div className="text-[10px] uppercase tracking-wider text-cdm-fg-muted">POT</div>
      <div className="text-2xl font-bold tabular-nums text-cdm-fg sm:text-3xl">
        {pot}
      </div>
      {communityCards && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] text-cdm-fg-muted">공유 카드</span>
          {communityCards.map((c, idx) => (
            <div
              key={idx}
              className={cn(
                'flex h-10 w-7 items-center justify-center rounded border-2 border-cdm-primary/60 bg-cdm-bg text-base font-bold sm:h-14 sm:w-10 sm:text-xl',
                c === 10 && 'text-sm sm:text-lg',
              )}
            >
              {c}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-cdm-fg-muted">
        {phaseLabel(phase)}
      </div>
    </div>
  );
}

function phaseLabel(phase: IPEPhase): string {
  switch (phase) {
    case 'waiting':
      return '대기 중 — 2명 이상이 모이면 자동 시작';
    case 'dealing':
      return '카드 배분 중';
    case 'betting':
      return '베팅 중';
    case 'showdown':
      return '쇼다운';
    case 'dieResult':
      return '핸드 종료';
    case 'closed':
      return '운영 시간 외';
    default:
      return '';
  }
}
