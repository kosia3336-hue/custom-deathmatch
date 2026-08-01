'use client';

import { cn } from '@/lib/utils';
import { formatGachaPercent } from '@/lib/gacha/format';
import type { GachaPoolResponse } from '@/lib/gacha/types';
import GachaGradeBadge from './GachaGradeBadge';
import GachaIneligibleBadge from './GachaIneligibleBadge';

interface Props {
  pool: GachaPoolResponse;
}

export default function GachaOddsPanel({ pool }: Props) {
  return (
    <div
      className="max-h-[min(52dvh,420px)] overflow-y-auto overscroll-contain pr-1 -mr-1"
      role="region"
      aria-label="뽑기 확률표"
    >
      <p className="mb-3 text-xs text-cdm-fg-muted">
        아래는 <strong className="text-cdm-fg">현재 기준</strong> 당첨 가능 확률입니다. 보유·소진 항목은 취소선으로 표시됩니다.
      </p>

      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
        {pool.grades.map((g) => (
          <section key={g.grade} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 border-b border-cdm-border pb-1.5">
              <div className="flex items-center gap-2">
                <GachaGradeBadge grade={g.grade} />
                <span className="text-xs font-semibold text-cdm-fg-muted">
                  {g.grade === 'S' ? '레전드' : `${g.grade} 등급`}
                </span>
              </div>
              <span className="text-xs tabular-nums text-cdm-fg-muted">
                {formatGachaPercent(g.effectiveRate)}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {g.prizes.map((p) => (
                <li key={p.id}>
                  <div
                    className={cn(
                      'flex items-start justify-between gap-2 py-0.5',
                      !p.eligible && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'text-sm text-cdm-fg',
                            !p.eligible && 'line-through text-cdm-fg-muted',
                          )}
                        >
                          {p.displayName}
                        </span>
                        {!p.eligible && p.ineligibleReason && (
                          <GachaIneligibleBadge reason={p.ineligibleReason} />
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-cdm-fg-muted">
                      {p.eligible ? formatGachaPercent(p.effectiveRate) : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
