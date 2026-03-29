'use client';

import { ReactNode, useState, useCallback } from 'react';
import { useRoomStore } from '@/stores/room';
import { RoomLayoutContext } from '@/contexts/RoomLayoutContext';

export default function RoomLayout({ children }: { children: ReactNode }) {
  const room = useRoomStore((s) => s.room);

  const [headerRight, setHeaderRightState] = useState<ReactNode>(null);
  const [footer, setFooterState] = useState<ReactNode>(null);

  const setHeaderRight = useCallback((content: ReactNode) => setHeaderRightState(content), []);
  const setFooter = useCallback((content: ReactNode) => setFooterState(content), []);

  return (
    <RoomLayoutContext.Provider value={{ setHeaderRight, setFooter }}>
      <div className="flex min-h-screen flex-col bg-gray-50">
        {/* 공통 헤더 */}
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {room ? (
                <>
                  <h1 className="truncate text-base font-bold text-gray-900 md:text-lg">
                    {room.title}
                  </h1>
                  <p className="text-xs text-gray-500 md:text-sm">
                    {room.gameName}
                    {' · '}
                    {room.playMode === 'multi' ? '멀티' : room.playMode === 'com' ? 'COM' : '솔로'}
                  </p>
                </>
              ) : (
                <div className="space-y-1.5">
                  <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
                  <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              {headerRight}
            </div>
          </div>
        </div>

        {/* 페이지 콘텐츠 */}
        <div className="flex flex-1 flex-col">{children}</div>

        {/* 공통 푸터 */}
        {footer && (
          <div className="sticky bottom-0 z-40 border-t border-gray-200 bg-white px-4 py-3 md:px-6">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 md:gap-3">
              {footer}
            </div>
          </div>
        )}
      </div>
    </RoomLayoutContext.Provider>
  );
}
