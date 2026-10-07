'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  GameToolsContext,
  useGameToolsRegistration,
  type GameTool,
} from '@/contexts/GameToolsContext';
import { GameReferenceParts } from './GameInfoPart';
import { GameFrame } from './GameFrame';
import styles from './game-reference-frame.module.css';

/** 독립 창 한 벌을 PC 도킹과 모바일 고정 위치에서 공유한다. 모바일 메모는 탭으로 접근한다. */
export function GameReferenceFrame({
  reference,
  info,
  controls,
  children,
  className,
  historyAboveStage = false,
  baseSkin = true,
}: {
  reference: ReactNode;
  info?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 넘버4처럼 모바일 기록은 점수 바로 아래, 추리는 게임판 아래에 둔다. */
  historyAboveStage?: boolean;
  /** 별도 스킨의 외곽선은 해당 스킨이 관리한다. */
  baseSkin?: boolean;
}) {
  const parent = useGameToolsRegistration();
  const desktop = parent?.desktop ?? false;
  const parentRegister = parent?.register;
  const parentUnregister = parent?.unregister;
  const [registered, setRegistered] = useState<Record<string, GameTool>>({});
  const register = useCallback(
    (tool: GameTool) => {
      setRegistered((previous) =>
        previous[tool.id] === tool ? previous : { ...previous, [tool.id]: tool },
      );
      if (desktop) parentRegister?.(tool);
    },
    [desktop, parentRegister],
  );
  const unregister = useCallback(
    (id: string) => {
      setRegistered((previous) => {
        if (!previous[id]) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      });
      parentUnregister?.(id);
    },
    [parentUnregister],
  );
  const registration = useMemo(
    () => ({ desktop, register, unregister }),
    [desktop, register, unregister],
  );
  const parts = Object.values(registered).sort(
    (a, b) => (a.defaultOrder ?? 30) - (b.defaultOrder ?? 30),
  );
  const score = parts.filter((tool) => tool.defaultOrder === 0);
  const history = historyAboveStage ? parts.filter((tool) => tool.defaultOrder === 10) : [];
  const references = parts.filter(
    (tool) => tool.defaultOrder !== 0 && (!historyAboveStage || tool.defaultOrder !== 10),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = references.find((tool) => tool.id === selectedId) ?? references[0];
  return (
    <>
      <GameToolsContext.Provider value={registration}>
        <GameReferenceParts tone="light">{reference}</GameReferenceParts>
      </GameToolsContext.Provider>
      <GameFrame
        className={`${baseSkin ? styles.base : ''} ${className ?? ''}`}
        info={
          <>
            {info}
            {!desktop && score.length > 0 && (
              <div className={styles.score}>
                {score.map((tool) => (
                  <div key={tool.id}>{tool.content}</div>
                ))}
              </div>
            )}
            {!desktop &&
              history.map((tool) => (
                <section key={tool.id} className={styles.history} aria-label={tool.title}>
                  {tool.content}
                </section>
              ))}
          </>
        }
        controls={
          <>
            {controls}
            {!desktop && references.length > 0 && (
              <section className={styles.references} aria-label="게임 기록과 메모">
                {(!historyAboveStage || references.length > 1) && (
                  <div className={styles.tabs} role="tablist" aria-label="기록·메모 선택">
                    {references.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        role="tab"
                        aria-selected={tool.id === selected?.id}
                        onClick={() => setSelectedId(tool.id)}
                      >
                        {tool.title}
                      </button>
                    ))}
                  </div>
                )}
                {references.map((tool) => (
                  <div
                    key={tool.id}
                    role={historyAboveStage && references.length === 1 ? 'region' : 'tabpanel'}
                    aria-label={tool.title}
                    data-size-to-content={tool.sizeToContent || undefined}
                    hidden={tool.id !== selected?.id}
                    className={`${styles.content} ${historyAboveStage && references.length === 1 ? styles.stackedContent : ''}`}
                  >
                    {tool.content}
                  </div>
                ))}
              </section>
            )}
          </>
        }
      >
        {children}
      </GameFrame>
    </>
  );
}
