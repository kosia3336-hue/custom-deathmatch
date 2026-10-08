'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  GameToolsContext,
  useGameToolsRegistration,
  type GameTool,
} from '@/contexts/GameToolsContext';
import { useGameToolRegistration } from '@/hooks/useGameToolRegistration';
import { gameReferenceKind } from '@/lib/gameReferencePolicy';
import { GameReferenceParts } from './GameInfoPart';
import { GameFrame } from './GameFrame';
import styles from './game-reference-frame.module.css';

const EMPTY_TOOLS: GameTool[] = [];

/** 점수는 게임판 위, 모바일 메모는 아래, 기록은 별도 아이콘으로 연다. */
export function GameReferenceFrame({
  reference,
  tools = EMPTY_TOOLS,
  info,
  controls,
  children,
  className,
  autoAboveStage = false,
}: {
  reference?: ReactNode;
  tools?: GameTool[];
  info?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 자동 카운팅을 점수 바로 아래에 배치한다. 'mobile'이면 PC 도킹 위치는 유지한다. */
  autoAboveStage?: boolean | 'mobile';
}) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const [registered, setRegistered] = useState<Record<string, GameTool>>({});
  const register = useCallback((tool: GameTool) => {
    setRegistered((previous) =>
      previous[tool.id] === tool ? previous : { ...previous, [tool.id]: tool },
    );
  }, []);
  const unregister = useCallback((id: string) => {
    setRegistered((previous) => {
      if (!previous[id]) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);
  const registration = useMemo(
    () => ({ desktop, register, unregister }),
    [desktop, register, unregister],
  );
  const parts = useMemo(
    () =>
      [...tools, ...Object.values(registered)]
        .map((tool) => ({ ...tool, kind: tool.kind ?? gameReferenceKind(tool.title) }))
        .sort((a, b) => (a.defaultOrder ?? 30) - (b.defaultOrder ?? 30)),
    [tools, registered],
  );
  const docked = useMemo(
    () =>
      parts.map((tool) =>
        tool.kind === 'score' || (autoAboveStage === true && tool.kind === 'auto')
          ? { ...tool, defaultEdge: 'top' as const, sizeToContent: true, stacked: true }
          : tool,
      ),
    [parts, autoAboveStage],
  );
  // 모바일에서도 기록 원본을 등록해 공통 상단 바의 기록 아이콘이 같은 내용을 연다.
  useGameToolRegistration(docked);
  const score = parts.filter((tool) => tool.kind === 'score');
  const above = [...score, ...(autoAboveStage ? parts.filter((tool) => tool.kind === 'auto') : [])];
  const notes = parts.filter(
    (tool) => (tool.kind === 'auto' && !autoAboveStage) || tool.kind === 'memo',
  );
  return (
    <>
      <GameToolsContext.Provider value={registration}>
        <GameReferenceParts tone="light">{reference}</GameReferenceParts>
      </GameToolsContext.Provider>
      <GameFrame
        className={className}
        info={
          (!desktop && above.length > 0) || info ? (
            <>
              {!desktop && above.length > 0 && (
                <div className={styles.score} data-game-scoreboard>
                  {above.map((tool) => (
                    <section key={tool.id} aria-label={tool.title} data-game-reference-panel>
                      <div className={styles.panelHeading}>{tool.title}</div>
                      <div className={styles.scoreContent}>{tool.content}</div>
                    </section>
                  ))}
                </div>
              )}
              {info}
            </>
          ) : undefined
        }
        controls={
          <>
            {controls}
            {!desktop && notes.length > 0 && (
              <div className={styles.notes}>
                {notes.map((tool) => (
                  <section
                    key={tool.id}
                    aria-label={tool.title}
                    data-game-reference-panel
                    data-reference-kind={tool.kind}
                    className={styles.references}
                  >
                    <div className={styles.panelHeading}>{tool.title}</div>
                    <div
                      className={styles.content}
                      data-size-to-content={tool.sizeToContent || undefined}
                    >
                      {tool.content}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        }
      >
        {children}
      </GameFrame>
    </>
  );
}
