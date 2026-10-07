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
}: {
  reference?: ReactNode;
  tools?: GameTool[];
  info?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
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
  const docked = useMemo(() => parts.filter((tool) => tool.kind !== 'score'), [parts]);
  // 모바일에서도 기록 원본을 등록해 공통 상단 바의 기록 아이콘이 같은 내용을 연다.
  useGameToolRegistration(docked);
  const score = parts.filter((tool) => tool.kind === 'score');
  const notes = parts.filter((tool) => tool.kind === 'auto' || tool.kind === 'memo');
  return (
    <>
      <GameToolsContext.Provider value={registration}>
        <GameReferenceParts tone="light">{reference}</GameReferenceParts>
      </GameToolsContext.Provider>
      <GameFrame
        className={className}
        info={
          <>
            {score.length > 0 && (
              <div className={styles.score} data-game-scoreboard>
                {score.map((tool) => (
                  <section key={tool.id} aria-label={tool.title} data-game-reference-panel>
                    <div className={styles.panelHeading}>{tool.title}</div>
                    <div className={styles.scoreContent}>{tool.content}</div>
                  </section>
                ))}
              </div>
            )}
            {info}
          </>
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
