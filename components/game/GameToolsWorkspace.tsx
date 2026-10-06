'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useDockState } from '@/hooks/useDockState';
import { DEFAULT_DOCK_STATE, resolveDrop, setDockState, type DockEdge } from '@/lib/dockPanel';
import { getToolInsertion } from '@/lib/gameToolDrop';
import {
  GameToolsContext,
  type GameTool,
  type GameToolsController,
} from '@/contexts/GameToolsContext';
import DockablePanel from '@/components/cdm/DockablePanel';
import { Icon } from '@/components/cdm';
import styles from './game-tools.module.css';

const LABELS = { top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽' };
// 이전 상·하 기본 배치와 구분한다. 이후 사용자 변경은 게임별로 계속 기억한다.
const dockId = (scope: string, id: string) => `game-tools:v2:${scope}:${id}`;
type ToolEdge = DockEdge | 'floating';
type ToolRegions = Partial<Record<ToolEdge, HTMLElement>>;

/** 같은 가장자리의 창을 하나의 스크롤 영역에 모은다. 게임판은 스크롤하지 않는다. */
export default function GameToolsWorkspace({
  controller,
  children,
}: {
  controller: GameToolsController;
  children: ReactNode;
}) {
  const regions = useRef<ToolRegions>({});
  useEffect(() => {
    if (!controller.desktop) return;
    // 상·하 영역은 가로 배열이다. 세로로 스크롤할 내용이 없으면 일반 휠도 가로 이동에 쓴다.
    const cleanups = (['top', 'bottom'] as const).flatMap((edge) => {
      const region = regions.current[edge];
      if (!region) return [];
      const onWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        const canScrollY = (element: HTMLElement) => {
          const overflow = getComputedStyle(element).overflowY;
          if (!['auto', 'scroll'].includes(overflow)) return false;
          const max = element.scrollHeight - element.clientHeight;
          return (
            max > 1 && (event.deltaY < 0 ? element.scrollTop > 0 : element.scrollTop < max - 1)
          );
        };
        let current = event.target instanceof HTMLElement ? event.target : null;
        while (current && region.contains(current)) {
          if (canScrollY(current)) return;
          if (current === region) break;
          current = current.parentElement;
        }
        if (region.scrollWidth <= region.clientWidth + 1) return;
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? region.clientWidth : 1;
        const previous = region.scrollLeft;
        region.scrollLeft += event.deltaY * scale;
        if (region.scrollLeft !== previous) event.preventDefault();
      };
      region.addEventListener('wheel', onWheel, { passive: false });
      return [() => region.removeEventListener('wheel', onWheel)];
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [controller.desktop]);
  return (
    <GameToolsContext.Provider value={controller.registration}>
      <div className={controller.desktop ? styles.workspace : styles.mobile}>
        {controller.desktop &&
          (['top', 'left', 'right', 'bottom'] as const).map((edge) => (
            <section
              key={edge}
              ref={(element) => {
                if (element) regions.current[edge] = element;
                else delete regions.current[edge];
              }}
              aria-label={`${LABELS[edge]} 편의기능 영역`}
              className={`${styles.region} ${styles[edge]}`}
            ></section>
          ))}
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
          controller.tools
            .filter((tool) => !controller.hidden[tool.id])
            .map((tool) => (
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
  regions: RefObject<ToolRegions>;
}) {
  const id = dockId(controller.scope, tool.id);
  const dock = useDockState(id, DEFAULT_DOCK_STATE);
  // 같은 portal 컨테이너를 이동한다. 채팅 초안·선택한 기록은 위치 변경 중에도 유지된다.
  const [host] = useState(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  );
  const edge: ToolEdge = dock.mode === 'docked' ? dock.edge : 'floating';
  useLayoutEffect(() => {
    if (!host) return;
    host.className = styles.host;
    host.dataset.toolId = tool.id;
    const region = regions.current[edge];
    if (!region) return;
    const order = controller.tools.map((item) => item.id);
    const index = order.indexOf(tool.id);
    const next = Array.from(region.children).find(
      (item) => item !== host && order.indexOf((item as HTMLElement).dataset.toolId ?? '') > index,
    );
    if (host.parentElement !== region || host.nextElementSibling !== (next ?? null)) {
      region.insertBefore(host, next ?? null);
    }
  }, [host, edge, regions, tool.id, controller.tools]);
  useLayoutEffect(
    () => () => {
      host?.remove();
    },
    [host],
  );
  if (!host) return null;
  const peers = (target: DockEdge) =>
    Array.from(regions.current[target]?.children ?? []).filter(
      (item): item is HTMLElement => item instanceof HTMLElement,
    );
  const insertion = (target: DockEdge, x: number, y: number) => {
    const region = regions.current[target]?.getBoundingClientRect();
    if (!region || region.width <= 0 || region.height <= 0) return null;
    const items = peers(target).flatMap((item) => {
      const peerId = item.dataset.toolId;
      const rect = item.querySelector('section')?.getBoundingClientRect();
      return peerId && peerId !== tool.id && rect ? [{ id: peerId, rect }] : [];
    });
    return getToolInsertion(target, x, y, region, items);
  };
  return createPortal(
    <DockablePanel
      id={id}
      title={tool.title}
      dock={dock}
      floatingSize={{ width: 340, height: tool.height ?? 300 }}
      className={styles.panel}
      resolveDockTarget={(x, y) => {
        for (const target of ['top', 'bottom', 'left', 'right'] as const) {
          const rect = regions.current[target]?.getBoundingClientRect();
          if (
            rect &&
            rect.width > 0 &&
            rect.height > 0 &&
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          )
            return target;
        }
        return resolveDrop(x, y, window.innerWidth, window.innerHeight);
      }}
      getInsertionGuide={(target, x, y) => insertion(target, x, y)?.guide ?? null}
      onDockDrop={(target, x, y) => {
        controller.moveBefore(tool.id, insertion(target, x, y)?.beforeId);
      }}
      onReorder={(direction) => {
        if (dock.mode !== 'docked') return;
        const ids = peers(dock.edge).map((item) => item.dataset.toolId!);
        const index = ids.indexOf(tool.id);
        if (index < 0 || index + direction < 0 || index + direction >= ids.length) return;
        controller.moveBefore(tool.id, ids[direction < 0 ? index - 1 : index + 2]);
      }}
    >
      <div
        className={`${styles.body} ${tool.sizeToContent ? styles.contentSized : ''}`}
        style={{ '--tool-height': `${tool.height ?? 300}px` } as CSSProperties}
      >
        {tool.content}
      </div>
    </DockablePanel>,
    host,
  );
}

/** 숨긴 창 다시 열기와 전체 배치 초기화. 헤더는 provider 바깥에 그려져 controller를 명시적으로 넘긴다. */
export function GameToolsMenu({ controller }: { controller: GameToolsController }) {
  const [open, setOpen] = useState(false);
  if (!controller.desktop) return null;
  return (
    <div className={styles.menu}>
      <button
        type="button"
        aria-label="편의기능"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-cdm-md text-cdm-ink-fg-muted flex flex-col items-center gap-0.5 px-1.5 py-1 hover:bg-white/10 hover:text-white"
      >
        <Icon name="memo" />
        <span className="text-[11px] leading-none">편의기능</span>
      </button>
      {open && (
        <div className={styles.menuBody} role="group" aria-label="편의기능 표시 설정">
          {controller.tools.map((tool) => (
            <label key={tool.id}>
              <input
                type="checkbox"
                checked={!controller.hidden[tool.id]}
                onChange={(e) => controller.setVisible(tool.id, e.target.checked)}
              />
              {tool.title}
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              controller.tools.forEach((tool) => {
                setDockState(dockId(controller.scope, tool.id), DEFAULT_DOCK_STATE);
                controller.setVisible(tool.id, true);
              });
              controller.resetOrder();
              setOpen(false);
            }}
          >
            기본 배치로
          </button>
        </div>
      )}
    </div>
  );
}
