'use client';

import { useRef, type ReactNode, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_DOCK_STATE } from '@/lib/dockPanel';
import { gameToolDockId, horizontalDockLimit } from '@/lib/gameToolsLayout';
import {
  GameToolsContext,
  type GameTool,
  type GameToolsController,
} from '@/contexts/GameToolsContext';
import { useDockWheel } from '@/hooks/useDockWheel';
import { useStableToolHost } from '@/hooks/useStableToolHost';
import { useDockTargets, type DockRegions, type ToolEdge } from '@/hooks/useDockTargets';
import DockablePanel from '@/components/cdm/DockablePanel';
import styles from './game-tools.module.css';

const LABELS = { top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽' };

/** 레이아웃과 렌더링만 담당한다. 포인터/휠/저장/portal 수명은 전용 hook에서 관리한다. */
export default function GameToolsWorkspace({
  controller,
  children,
}: {
  controller: GameToolsController;
  children: ReactNode;
}) {
  const regions = useRef<DockRegions>({});
  useDockWheel(regions, controller.desktop);
  return (
    <GameToolsContext.Provider value={controller.registration}>
      <div className={controller.desktop ? styles.workspace : styles.mobile}>
        {controller.desktop &&
          (['top', 'left', 'right', 'bottom'] as const).map((edge) => {
            const minimum = Math.max(
              0,
              ...controller.tools.map((tool) => {
                const dock = controller.docks[tool.id];
                return dock?.mode === 'docked' && dock.edge === edge
                  ? (tool.minBodyHeight ?? 0)
                  : 0;
              }),
            );
            return (
              <section
                key={edge}
                ref={(element) => {
                  if (element) regions.current[edge] = element;
                  else delete regions.current[edge];
                }}
                aria-label={`${LABELS[edge]} 편의기능 영역`}
                className={`${styles.region} ${styles[edge]}`}
                style={
                  edge === 'top' || edge === 'bottom'
                    ? ({ '--region-limit': horizontalDockLimit(edge, minimum) } as CSSProperties)
                    : undefined
                }
              />
            );
          })}
        <div key="game" className={styles.game}>
          {children}
        </div>
        {controller.desktop && (
          <div
            ref={(element) => {
              if (element) regions.current.floating = element;
              else delete regions.current.floating;
            }}
            className={styles.floating}
          />
        )}
        {controller.desktop &&
          controller.tools.map((tool) => (
            <ToolPanel key={tool.id} controller={controller} tool={tool} regions={regions} />
          ))}
      </div>
    </GameToolsContext.Provider>
  );
}

function ToolPanel({
  controller,
  tool,
  regions,
}: {
  controller: GameToolsController;
  tool: GameTool;
  regions: RefObject<DockRegions>;
}) {
  const id = gameToolDockId(controller.scope, tool.id);
  const dock = controller.docks[tool.id] ?? DEFAULT_DOCK_STATE;
  const edge: ToolEdge = dock.mode === 'docked' ? dock.edge : 'floating';
  const host = useStableToolHost(regions, edge, tool.id, controller.orderedIds, styles.host);
  const targets = useDockTargets(regions, tool.id, dock, controller.moveBefore);
  if (!host) return null;
  return createPortal(
    <DockablePanel
      id={id}
      title={tool.title}
      headerTitle={tool.headerTitle}
      headerActions={tool.headerActions}
      dock={dock}
      floatingSize={{ width: 340, height: tool.preferredBodyHeight ?? 300 }}
      className={styles.panel}
      {...targets}
    >
      <div
        className={`${styles.body} ${tool.sizeToContent ? styles.contentSized : ''}`}
        style={
          {
            '--tool-height': `${tool.preferredBodyHeight ?? 300}px`,
            '--tool-min-body-height': `${tool.minBodyHeight ?? 0}px`,
          } as CSSProperties
        }
      >
        {tool.content}
      </div>
    </DockablePanel>,
    host,
  );
}
