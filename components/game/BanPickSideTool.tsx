'use client';

import { useMemo, type ReactNode } from 'react';
import { useGameDesktop, type GameTool } from '@/contexts/GameToolsContext';
import { useGameToolRegistration } from '@/hooks/useGameToolRegistration';
import { cn } from '@/lib/utils';

/**
 * 밴픽 넓은 화면의 사이드바(플레이어·타이머·밴 순서)를 편의기능 창으로 등록한다.
 * 채팅 창(오른쪽 기본, defaultOrder -10) 아래에 붙고, 다른 창처럼 떼었다 붙였다 할 수 있다.
 * 좁은 화면은 각 밴픽 화면이 위쪽에 따로 그리므로 등록하지 않는다.
 */
export function BanPickSideTool({
  title = '밴픽 정보',
  ink = false,
  children,
}: {
  title?: string;
  /** 카운터매치처럼 어두운 화면이면 창 안도 어두운 토큰으로 그린다. */
  ink?: boolean;
  children: ReactNode;
}) {
  const desktop = useGameDesktop();
  const tools = useMemo<GameTool[]>(
    () =>
      desktop
        ? [
            {
              id: 'banpick-side',
              title,
              defaultOrder: 0,
              defaultEdge: 'right',
              sizeToContent: true,
              content: (
                <div
                  className={cn(
                    'flex flex-col gap-4',
                    ink && 'ink-scope bg-cdm-ink rounded-cdm-md text-cdm-ink-fg p-3',
                  )}
                >
                  {children}
                </div>
              ),
            },
          ]
        : [],
    [desktop, title, ink, children],
  );
  useGameToolRegistration(tools);
  return null;
}
