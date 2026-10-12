'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════
 * 추상전략 판 정보 한 줄 — 누가 어느 말인지, 말이 얼마나 남았는지.
 *
 * 추상전략은 '내 말이 무슨 색인지' 를 모르면 판을 읽을 수 없다. 상단 메모에
 * 넣어 두었더니 두기 전에 매번 메모를 열어야 했다. 한 줄이라 무대를 거의
 * 먹지 않으므로 뼈대의 info 자리에 늘 펴 둔다(design.md §14.9).
 *
 * PC·모바일 모두 게임판 위에 표시한다. 별도 플레이어 패널을 중복 등록하지 않는다.
 * ════════════════════════════════════════════════════════════ */

export interface PlayerStripEntry {
  id: string;
  name: string;
  isMe?: boolean;
  /** 이 사람의 말 모양 — 돌 색·진영 색 */
  marker: ReactNode;
  /** 남은 말처럼 짧은 숫자 */
  detail?: ReactNode;
  /** 이름을 가리지 않도록 다음 줄에 표시할 말 수 등. */
  secondaryDetail?: ReactNode;
  /** 지금 차례 */
  active?: boolean;
}

export function PlayerStrip({
  entries,
  extra,
  className,
  desktopVisible = true,
}: {
  entries: PlayerStripEntry[];
  /** 두 사람 몫이 아닌 판 전체 정보(중립 돌 따위) */
  extra?: ReactNode;
  className?: string;
  /** PCでも判の上に常時表示し、別のプレイヤーパネルを使わない。 */
  desktopVisible?: boolean;
}) {
  return (
    <div
      className={cn(
        'abstract-player-strip border-cdm-border bg-cdm-bg text-cdm-fg rounded-cdm-lg flex items-stretch overflow-hidden border',
        !desktopVisible && 'lg:hidden',
        className,
      )}
    >
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          aria-current={entry.active ? 'true' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5',
            entry.secondaryDetail != null && 'flex-wrap',
            index > 0 && 'border-cdm-border border-l',
            entry.active && 'bg-cdm-primary-soft shadow-[inset_3px_0_0_var(--cdm-primary)]',
          )}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">{entry.marker}</span>
          <span
            className={cn(
              'min-w-0 truncate text-xs font-bold',
              entry.isMe ? 'text-cdm-primary' : 'text-cdm-fg',
            )}
          >
            {entry.name}
            {entry.isMe && <span className="text-[11px]"> (나)</span>}
          </span>
          {entry.detail != null && (
            <span className="text-cdm-fg-muted ml-auto shrink-0 text-[11px] font-bold tabular-nums">
              {entry.detail}
            </span>
          )}
          {entry.secondaryDetail != null && (
            <span className="text-cdm-fg-muted w-full text-right text-[11px] font-bold tabular-nums">
              {entry.secondaryDetail}
            </span>
          )}
        </div>
      ))}
      {extra != null && (
        <div className="border-cdm-border text-cdm-fg-muted flex shrink-0 items-center gap-1.5 border-l px-2.5 text-[11px] font-bold tabular-nums">
          {extra}
        </div>
      )}
    </div>
  );
}
