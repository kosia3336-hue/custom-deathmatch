'use client';

import type { NumberFourGameData } from '@/shared/types/number4';
import type { NumberFourRoundNotes } from '@/lib/numberFourNotes';
import { useRef, useLayoutEffect } from 'react';
import styles from './number-four.module.css';

/** 기록은 최신순 세로 목록. 기록 열람·스크롤은 메모 편집 라운드와 독립적이다. */
export default function RoundHistory({
  gameData,
  compact,
  notes,
}: {
  gameData: NumberFourGameData;
  compact: boolean;
  notes: NumberFourRoundNotes;
}) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0;
  }, [gameData.round, gameData.roundHistory.length]);
  const rounds = [...gameData.roundHistory].sort((a, b) => b.round - a.round).map((r) => r.round);
  return (
    <section
      aria-label="라운드 기록"
      className={
        compact
          ? 'border-cdm-border min-w-0 rounded-lg border px-2 py-1.5'
          : 'flex min-h-0 min-w-0 flex-1 flex-col'
      }
    >
      <div className="text-cdm-fg-muted flex shrink-0 flex-wrap items-center justify-between gap-1 text-[11px] font-semibold">
        <span>라운드 기록</span>
      </div>
      <div
        ref={list}
        tabIndex={0}
        aria-label="라운드 기록 스크롤"
        className={`${styles.historyList} ${compact ? '' : styles.desktopHistory} mt-1`}
      >
        {!rounds.length && (
          <p className="text-cdm-fg-muted py-1 text-[11px]">아직 기록이 없습니다.</p>
        )}
        {rounds.map((round) => {
          const record = gameData.roundHistory.find((r) => r.round === round);
          const own = Object.values(record?.players ?? {}).find((p) => p.white !== undefined);
          const content = (
            <>
              <div className="text-cdm-fg-muted flex shrink-0 flex-wrap items-center justify-between gap-x-2 text-[11px]">
                <span>
                  R{round}
                  {round < gameData.round ? ' · 이전 기록' : ''}
                  {notes[round] ? ' · 메모' : ''}
                </span>
                {own && (
                  <span>
                    내 제출 □{own.white} ■{own.black}
                  </span>
                )}
              </div>
              {record ? (
                Object.entries(record.players).map(([id, p]) => (
                  <div key={id} className="flex min-w-0 items-center gap-2">
                    <span
                      className="max-w-24 min-w-0 truncate"
                      title={gameData.players[id]?.nickname}
                    >
                      {gameData.players[id]?.nickname}
                    </span>
                    <span className="shrink-0 font-semibold">N{p.number}</span>
                    <span
                      className={`shrink-0 tabular-nums ${p.success ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {p.scoreChange > 0 ? '+' : ''}
                      {p.scoreChange}
                    </span>
                    <span className="text-cdm-fg-muted shrink-0">({p.scoreAfter}점)</span>
                  </div>
                ))
              ) : (
                <p className="text-cdm-fg-muted py-1 text-[11px]">제출 진행 중</p>
              )}
            </>
          );
          return (
            <div
              key={round}
              aria-label={`${round}라운드 기록`}
              className="border-cdm-border bg-cdm-bg-elev-1 min-w-0 rounded-md border px-2 py-1 text-left text-xs leading-5"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
