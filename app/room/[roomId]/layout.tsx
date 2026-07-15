'use client';

import { ReactNode, useState, useCallback } from 'react';
import { useRoomStore } from '@/stores/room';
import { RoomLayoutContext } from '@/contexts/RoomLayoutContext';
import { RankQueueDesktopChip } from '@/components/rank/RankQueueFloatingIndicator';

export default function RoomLayout({ children }: { children: ReactNode }) {
  const room = useRoomStore((s) => s.room);

  const [headerRight, setHeaderRightState] = useState<ReactNode>(null);
  const [footer, setFooterState] = useState<ReactNode>(null);
  const [footerHidden, setFooterHiddenState] = useState(false);

  const setHeaderRight = useCallback((content: ReactNode) => setHeaderRightState(content), []);
  const setFooter = useCallback((content: ReactNode) => setFooterState(content), []);
  const setFooterHidden = useCallback((hidden: boolean) => setFooterHiddenState(hidden), []);

  return (
    <RoomLayoutContext.Provider value={{ setHeaderRight, setFooter, setFooterHidden }}>
      <div className="flex min-h-screen flex-col bg-cdm-page">
        {/* 공통 헤더 */}
        <div className="ink-scope sticky top-0 z-(--cdm-z-sticky) border-b border-cdm-ink-border bg-cdm-ink/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {room ? (
                <>
                  <h1 className="truncate text-base font-bold text-cdm-fg md:text-lg">
                    {room.title}
                  </h1>
                  <p className="text-xs text-cdm-fg-muted md:text-sm">
                    {room.gameName}
                    {' · '}
                    {room.playMode === 'multi' ? '멀티' : room.playMode === 'com' ? 'COM' : '솔로'}
                  </p>
                </>
              ) : (
                <div className="space-y-1.5">
                  <div className="h-5 w-40 animate-pulse rounded bg-cdm-bg-elev-2" />
                  <div className="h-3.5 w-24 animate-pulse rounded bg-cdm-bg-elev-1" />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <span className="hidden md:flex items-center">
                <RankQueueDesktopChip />
              </span>
              {headerRight}
            </div>
          </div>
        </div>

        {/* 페이지 콘텐츠 */}
        <div className="flex flex-1 flex-col">{children}</div>

        {/* 공통 푸터 */}
        {footer && !footerHidden && (
          <div className="sticky bottom-0 z-(--cdm-z-sticky) border-t border-cdm-border bg-cdm-bg/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 md:gap-3">
              {footer}
            </div>
          </div>
        )}
      </div>
    </RoomLayoutContext.Provider>
  );
}
