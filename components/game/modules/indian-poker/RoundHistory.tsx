'use client';

import type { IPRoundRecord, IPPlayerInfo } from '@/shared/types/indian-poker';
import { useLayoutEffect, useRef } from 'react';
import { HAND_LABELS, HAND_COLORS } from './constants';

interface RoundHistoryProps {
  roundHistory: IPRoundRecord[];
  players: Record<string, IPPlayerInfo>;
  compact?: boolean;
  showTitle?: boolean;
}

export default function RoundHistory({
  roundHistory,
  players,
  compact = false,
  showTitle = true,
}: RoundHistoryProps) {
  const list = useRef<HTMLDivElement>(null);
  const latestRound = roundHistory.reduce((max, record) => Math.max(max, record.round), 0);
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0;
  }, [latestRound]);

  return (
    <section
      aria-label="라운드 기록"
      className={
        compact
          ? 'border-cdm-border min-w-0 rounded-lg border px-2 py-1.5'
          : 'flex min-h-0 flex-1 flex-col'
      }
    >
      {showTitle && (
        <h2 className="text-cdm-fg-muted mb-1 shrink-0 text-[11px] font-semibold">라운드 기록</h2>
      )}
      <div
        ref={list}
        tabIndex={0}
        aria-label="라운드 기록 스크롤"
        className={`flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain ${compact ? 'max-h-24' : 'flex-1'}`}
      >
        {!roundHistory.length && (
          <p className="text-cdm-fg-muted py-1 text-[11px]">아직 기록이 없습니다.</p>
        )}
        {[...roundHistory]
          .sort((a, b) => b.round - a.round)
          .map((r) => (
            <div
              key={r.round}
              aria-label={`${r.round}라운드 기록`}
              className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg shrink-0 rounded-md border px-2 py-1 text-xs leading-5"
            >
              <div className="text-cdm-fg-muted mb-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                <span className="font-medium">R{r.round}</span>
                <span>공유: [{r.communityCards.join(', ')}]</span>
                {r.isDie && <span className="text-red-400">다이</span>}
                {r.isDraw && <span className="text-gray-400">무승부</span>}
              </div>
              <div>
                {Object.keys(r.chipChanges).map((pid) => {
                  const p = players[pid];
                  const chipChange = r.chipChanges[pid];
                  const data = r.hands?.[pid];
                  return (
                    <div
                      key={pid}
                      className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs"
                    >
                      <span className="max-w-24 truncate" title={p?.nickname}>
                        {p?.nickname ?? '플레이어'}
                      </span>
                      {data && (
                        <>
                          <span className="font-semibold">{data.card}</span>
                          <span style={{ color: HAND_COLORS[data.hand] }}>
                            {HAND_LABELS[data.hand]}
                          </span>
                        </>
                      )}
                      <strong
                        className={`tabular-nums ${chipChange > 0 ? 'text-emerald-600' : chipChange < 0 ? 'text-red-500' : 'text-cdm-fg-muted'}`}
                      >
                        {chipChange > 0 ? '+' : ''}
                        {chipChange}칩
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
