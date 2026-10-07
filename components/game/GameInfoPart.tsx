'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useGameToolRegistration } from '@/hooks/useGameToolRegistration';
import type { GameTool } from '@/contexts/GameToolsContext';
import { cn } from '@/lib/utils';
import { gameReferenceOrder, gameReferenceKind } from '@/lib/gameReferencePolicy';

const SplitReferenceContext = createContext(false);
const ReferenceToneContext = createContext<'ink' | 'light'>('ink');
const ReferenceClassContext = createContext<string | undefined>(undefined);

/** PC에서는 원본 한 벌만 마운트해 각 정보 파츠를 독립 창으로 등록한다. */
export function GameReferenceParts({
  children,
  tone = 'ink',
}: {
  children: ReactNode;
  tone?: 'ink' | 'light';
}) {
  return (
    <SplitReferenceContext.Provider value={true}>
      <ReferenceToneContext.Provider value={tone}>
        <div hidden>{children}</div>
      </ReferenceToneContext.Provider>
    </SplitReferenceContext.Provider>
  );
}

/** 데스크톱 정보 창과 모바일 메모가 공유하는 정보 파츠. */
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
  defaultOrder,
  kind,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 제목이 동적으로 바뀌는 파츠는 저장용 id를 별도로 지정한다. */
  toolId?: string;
  preferredBodyHeight?: number;
  sizeToContent?: boolean;
  /** 게임별 기본 패널 순서. 지정하지 않으면 공통 배치 정책을 따른다. */
  defaultOrder?: number;
  kind?: GameTool['kind'];
}) {
  const split = useContext(SplitReferenceContext);
  const tone = useContext(ReferenceToneContext);
  const inheritedClass = useContext(ReferenceClassContext);
  const tools = useMemo<GameTool[]>(
    () =>
      split && (toolId || typeof title === 'string')
        ? [
            {
              id: `reference:${toolId ?? title}`,
              title: typeof title === 'string' ? title : '판 정보',
              kind: kind ?? gameReferenceKind(typeof title === 'string' ? title : '판 정보'),
              defaultOrder:
                defaultOrder ??
                gameReferenceOrder(typeof title === 'string' ? title : '판 정보', kind),
              preferredBodyHeight,
              sizeToContent,
              content: (
                <SplitReferenceContext.Provider value={false}>
                  <ReferenceToneContext.Provider value={tone}>
                    <div className={inheritedClass}>
                      <GameInfoPart className={className}>{children}</GameInfoPart>
                    </div>
                  </ReferenceToneContext.Provider>
                </SplitReferenceContext.Provider>
              ),
            },
          ]
        : [],
    [
      split,
      tone,
      toolId,
      title,
      preferredBodyHeight,
      sizeToContent,
      defaultOrder,
      kind,
      inheritedClass,
      className,
      children,
    ],
  );
  useGameToolRegistration(tools);
  if (split) return null;
  return (
    <section
      className={cn(
        'game-info-part rounded-cdm-lg border p-3',
        tone === 'light'
          ? 'border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg'
          : 'ink-scope border-cdm-ink-border bg-cdm-ink text-cdm-ink-fg shadow-sm',
        className,
      )}
    >
      {title != null && (
        <div className="text-cdm-fg-muted mb-2 text-xs font-semibold tracking-wide">{title}</div>
      )}
      {children}
    </section>
  );
}
