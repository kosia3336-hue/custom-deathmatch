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
import { useGameWorkspaceSize } from '@/hooks/useGameWorkspaceSize';
import { usePanelBodyHeight } from '@/hooks/usePanelBodyHeight';
import { useStableToolHost } from '@/hooks/useStableToolHost';
import { useDockTargets, type DockRegions, type ToolEdge } from '@/hooks/useDockTargets';
import DockablePanel from '@/components/cdm/DockablePanel';
import styles from './game-tools.module.css';
import { GameReferenceParts } from './GameInfoPart';
import type { SkinTheme } from '@/lib/skins/registry';
import { gamePanelSkinClass } from './GamePanelSkin';

const LABELS = { top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽' };

/** 레이아웃과 렌더링만 담당한다. 포인터/휠/저장/portal 수명은 전용 hook에서 관리한다. */
export default function GameToolsWorkspace({
  controller,
  children,
  skin = null,
}: {
  controller: GameToolsController;
  children: ReactNode;
  /** 게임판뿐 아니라 여백·독립 창 뒤까지 선택한 스킨 배경으로 채운다. */
  skin?: SkinTheme | null;
}) {
  const regions = useRef<DockRegions>({});
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const canvasHeight = useGameWorkspaceSize(viewport, canvas);
  useDockWheel(regions, controller.desktop);
  return (
    <GameToolsContext.Provider value={controller.registration}>
      {controller.desktop && controller.reference && (
        <GameReferenceParts key={controller.scope}>{controller.reference}</GameReferenceParts>
      )}
      <div ref={viewport} className={styles.viewport} data-game-scroll-viewport>
        <div
          ref={canvas}
          style={canvasHeight ? { height: canvasHeight } : undefined}
          data-game-skin={skin ?? 'base'}
          className={`${controller.desktop ? styles.workspace : styles.mobile} ${skin ? `skin-bg-${skin} ${gamePanelSkinClass(skin)}` : ''}`}
        >
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
                  data-game-dock-edge={edge}
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
              <ToolPanel
                key={`${controller.scope}:${tool.id}`}
                controller={controller}
                tool={tool}
                regions={regions}
              />
            ))}
        </div>
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
  const bodySize = usePanelBodyHeight(
    id,
    tool.preferredBodyHeight ?? 300,
    tool.minBodyHeight ?? 220,
  );
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
      floatingSize={{
        width: 340,
        height: tool.resizable ? bodySize.height + 64 : (tool.preferredBodyHeight ?? 300),
      }}
      className={`${styles.panel} game-tool-panel`}
      {...targets}
    >
      <div
        data-resizable-body={tool.resizable || undefined}
        data-top-stack={tool.stacked || undefined}
        className={`${styles.body} ${tool.sizeToContent ? styles.contentSized : ''} ${tool.resizable ? styles.resizable : ''}`}
        style={
          {
            '--tool-height': `${tool.resizable ? bodySize.height : (tool.preferredBodyHeight ?? 300)}px`,
            '--tool-min-body-height': `${tool.minBodyHeight ?? 0}px`,
          } as CSSProperties
        }
      >
        {tool.content}
      </div>
      {tool.resizable && (
        <div
          role="separator"
          tabIndex={0}
          aria-label={`${tool.title} 높이 조절`}
          aria-orientation="horizontal"
          aria-valuemin={bodySize.minimum}
          aria-valuemax={bodySize.maximum}
          aria-valuenow={bodySize.height}
          title="끌어서 높이 조절 · 위/아래 방향키"
          className={styles.resizeHandle}
          {...bodySize.handlers}
        >
          <span />
        </div>
      )}
    </DockablePanel>,
    host,
  );
}
