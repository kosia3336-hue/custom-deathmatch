'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useGameToolRegistration } from '@/hooks/useGameToolRegistration';
import type { GameTool } from '@/contexts/GameToolsContext';
import { cn } from '@/lib/utils';
import { gameReferenceOrder } from '@/lib/gameReferencePolicy';

const SplitReferenceContext = createContext(false);
const ReferenceClassContext = createContext<string | undefined>(undefined);

/** PC에서는 원본 한 벌만 마운트해 각 정보 파츠를 독립 창으로 등록한다. */
export function GameReferenceParts({ children }: { children: ReactNode }) {
  return (
    <SplitReferenceContext.Provider value={true}>
      <div hidden>{children}</div>
    </SplitReferenceContext.Provider>
  );
}

/** 데스크톱 우측 정보와 모바일 메모가 공유하는 짙은 정보 파츠. */
export function GameInfoStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const inherited = useContext(ReferenceClassContext);
  return (
    <ReferenceClassContext.Provider value={cn(inherited, className)}>
      <div className={cn('flex flex-col gap-3', className)}>{children}</div>
    </ReferenceClassContext.Provider>
  );
}

export function GameInfoPart({
  title,
  children,
  className,
  toolId,
  preferredBodyHeight = 240,
  sizeToContent = false,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 제목이 동적으로 바뀌는 파츠는 저장용 id를 별도로 지정한다. */
  toolId?: string;
  preferredBodyHeight?: number;
  sizeToContent?: boolean;
}) {
  const split = useContext(SplitReferenceContext);
  const inheritedClass = useContext(ReferenceClassContext);
  const tools = useMemo<GameTool[]>(
    () =>
      split && (toolId || typeof title === 'string')
        ? [
            {
              id: `reference:${toolId ?? title}`,
              title: typeof title === 'string' ? title : '판 정보',
              defaultOrder: gameReferenceOrder(typeof title === 'string' ? title : '판 정보'),
              preferredBodyHeight,
              sizeToContent,
              content: (
                <SplitReferenceContext.Provider value={false}>
                  <div className={inheritedClass}>
                    <GameInfoPart className={className}>{children}</GameInfoPart>
                  </div>
                </SplitReferenceContext.Provider>
              ),
            },
          ]
        : [],
    [split, toolId, title, preferredBodyHeight, sizeToContent, inheritedClass, className, children],
  );
  useGameToolRegistration(tools);
  if (split) return null;
  return (
    <section
      className={cn(
        'ink-scope rounded-cdm-lg border-cdm-ink-border bg-cdm-ink text-cdm-ink-fg border p-3 shadow-sm',
        className,
      )}
    >
      {title != null && (
        <div className="text-cdm-ink-fg-muted mb-2 text-xs font-semibold tracking-wide">
          {title}
        </div>
      )}
      {children}
    </section>
  );
}
