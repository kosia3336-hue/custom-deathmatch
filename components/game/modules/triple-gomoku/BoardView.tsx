'use client';

import { useState, type ReactNode } from 'react';
import { GamePiece3D } from '@/components/game/abstract-strategy';
import { cn } from '@/lib/utils';
import {
  TG_BOARD_ASPECT,
  tripleGomokuCellKey,
  tripleGomokuCells,
  tripleGomokuEdges,
  tripleGomokuPosition,
} from '@/shared/logic/triple-gomoku';
import {
  TG_MAX_HEIGHT,
  type TripleGomokuBoard,
  type TripleGomokuCell,
} from '@/shared/types/triple-gomoku';

/** 한 층이 올라갈 때 돌 지름 대비 얼마나 밀려 올라가는지. 위에서 봐도 층이 보이게 한다. */
const LAYER_RISE_PERCENT = 46;
/** 돌 지름을 칸 간격 대비 얼마로 그릴지. */
const STONE_WIDTH_PERCENT = 106;
/** 돌 높이 대 지름 비. 실제 바둑돌처럼 납작하게 그린다. */
const STONE_ASPECT = '1 / 0.62';
/** 맨 아래 돌을 격자점에 걸치도록 내리는 양. 돌 높이 대비 비율이다. */
const STONE_BASE_DROP_PERCENT = 52;
/** 격자선 굵기와 진하기. 옅으면 오목 줄을 눈으로 따라가기 어렵다. */
const GRID_STROKE_WIDTH = 2.2;
const GRID_STROKE_OPACITY = 0.72;
/** 미리보기 돌의 불투명도. */
const PREVIEW_OPACITY = 0.55;
// 격자 끝 좌표는 0 또는 1이다. 3층 돌과 선택 링까지 테두리 안에 들어오도록
// 격자·돌·터치 위치를 같은 여백 좌표로 옮긴다. 게임 규칙의 좌표는 바꾸지 않는다.
const BOARD_INSET = 0.1;
const BOARD_SCALE = 1 - BOARD_INSET * 2;
function boardPosition(cell: TripleGomokuCell) {
  const point = tripleGomokuPosition(cell);
  return { x: BOARD_INSET + point.x * BOARD_SCALE, y: BOARD_INSET + point.y * BOARD_SCALE };
}

export type TripleGomokuCellMark = 'none' | 'selected' | 'target' | 'win' | 'last';

export interface TripleGomokuBoardViewProps {
  board: TripleGomokuBoard;
  /** 첫 번째 플레이어 id. 색을 정하는 기준이다. */
  firstPlayerId: string;
  markOf?: (cell: TripleGomokuCell) => TripleGomokuCellMark;
  onCellClick?: (cell: TripleGomokuCell) => void;
  isEnabled?: (cell: TripleGomokuCell) => boolean;
  /** 커서를 올린 칸에 이 사람의 돌을 미리 보여 준다. null 이면 미리보기 없음. */
  previewOwnerId?: string | null;
  /** 터치 첫 탭으로 자리만 보여 주는 칸. 커서가 없어도 미리보기 돌을 띄운다. */
  armedKey?: string | null;
  ariaLabel: string;
  className?: string;
  footer?: ReactNode;
  /** 판 최대 너비. 자연 높이를 측정해 짧은 화면에서도 판을 잘라내지 않는다. */
  maxWidth?: string;
}

const MARK_RING: Record<TripleGomokuCellMark, string> = {
  none: '',
  selected: 'ring-2 ring-cdm-primary bg-cdm-primary-soft',
  target: 'ring-2 ring-cdm-success bg-cdm-success-soft',
  win: 'ring-2 ring-cdm-accent bg-cdm-accent-soft',
  last: 'ring-1 ring-cdm-highlight',
};

/** 한 칸에 쌓인 돌(또는 미리보기 돌) 하나. 아래층은 격자점에, 윗층은 그만큼 위로 그린다. */
function StoneLayer({
  layer,
  children,
  opacity,
}: {
  layer: number;
  children: ReactNode;
  opacity?: number;
}) {
  return (
    <span
      className="pointer-events-none absolute bottom-1/2 left-1/2 block"
      style={{
        width: `${STONE_WIDTH_PERCENT}%`,
        aspectRatio: STONE_ASPECT,
        transform: `translate(-50%, ${STONE_BASE_DROP_PERCENT - layer * LAYER_RISE_PERCENT}%)`,
        opacity,
        zIndex: layer + 1,
      }}
    >
      {children}
    </span>
  );
}

export function TripleGomokuBoardView({
  board,
  firstPlayerId,
  markOf,
  onCellClick,
  isEnabled,
  previewOwnerId = null,
  armedKey = null,
  ariaLabel,
  className,
  footer,
  maxWidth = '38rem',
}: TripleGomokuBoardViewProps) {
  const cells = tripleGomokuCells();
  const edges = tripleGomokuEdges();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div data-game-intrinsic-stage className={cn('mx-auto w-full', className)} style={{ maxWidth }}>
      <div
        className="relative mx-auto w-full"
        style={{ aspectRatio: `${TG_BOARD_ASPECT}` }}
        role="group"
        aria-label={ariaLabel}
      >
        <svg
          viewBox="0 0 1000 866"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="tg-surface" cx="50%" cy="42%" r="70%">
              <stop offset="0%" stopColor="var(--cdm-bg-elev-2)" />
              <stop offset="100%" stopColor="var(--cdm-bg-elev-1)" />
            </radialGradient>
          </defs>
          <rect
            x="1"
            y="1"
            width="998"
            height="864"
            rx="28"
            fill="url(#tg-surface)"
            stroke="var(--cdm-border-strong)"
            strokeWidth={2}
          />
          {edges.map(([from, to]) => {
            const a = boardPosition(from);
            const b = boardPosition(to);
            return (
              <line
                key={`${tripleGomokuCellKey(from)}-${tripleGomokuCellKey(to)}`}
                x1={a.x * 1000}
                y1={a.y * 866}
                x2={b.x * 1000}
                y2={b.y * 866}
                stroke="var(--cdm-fg-subtle)"
                strokeWidth={GRID_STROKE_WIDTH}
                strokeLinecap="round"
                opacity={GRID_STROKE_OPACITY}
              />
            );
          })}
          {cells.map((cell) => {
            const point = boardPosition(cell);
            return (
              <circle
                key={tripleGomokuCellKey(cell)}
                cx={point.x * 1000}
                cy={point.y * 866}
                r={6}
                fill="var(--cdm-fg-muted)"
                opacity={0.85}
              />
            );
          })}
        </svg>

        {cells.map((cell) => {
          const key = tripleGomokuCellKey(cell);
          const point = boardPosition(cell);
          const stack = board[key] ?? [];
          const mark = markOf?.(cell) ?? 'none';
          const enabled = Boolean(onCellClick) && (isEnabled?.(cell) ?? false);
          // 놓을 수 있는 칸에 커서를 올렸을 때만 반투명 돌로 결과를 미리 보여 준다.
          const showPreview =
            enabled &&
            previewOwnerId != null &&
            (hoveredKey === key || armedKey === key) &&
            stack.length < TG_MAX_HEIGHT;
          const Tag = onCellClick ? 'button' : 'div';
          return (
            <Tag
              key={key}
              {...(onCellClick
                ? {
                    type: 'button' as const,
                    onClick: () => onCellClick(cell),
                    disabled: !enabled,
                    onMouseEnter: () => setHoveredKey(key),
                    onMouseLeave: () =>
                      setHoveredKey((current) => (current === key ? null : current)),
                    onFocus: () => setHoveredKey(key),
                    onBlur: () => setHoveredKey((current) => (current === key ? null : current)),
                    'aria-label': `${cell.q},${cell.r} 칸${stack.length ? `, ${stack.length}층` : ', 빈칸'}`,
                  }
                : { 'aria-hidden': true as const })}
              className={cn(
                'absolute rounded-full transition-colors',
                mark !== 'none' && MARK_RING[mark],
                // 목적지 표시(target) 위에서도 '여기 둘 예정' 이 보이게 테두리를 덮어쓴다
                armedKey === key && enabled && 'ring-cdm-primary ring-2',
                enabled ? 'cursor-pointer' : 'cursor-default',
              )}
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                width: `${8 * BOARD_SCALE}%`,
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {stack.map((ownerId, layer) => (
                <StoneLayer key={`${key}-${layer}`} layer={layer}>
                  <GamePiece3D
                    tone={ownerId === firstPlayerId ? 'primary' : 'highlight'}
                    selected={mark === 'selected' && layer === stack.length - 1}
                  />
                </StoneLayer>
              ))}
              {showPreview && (
                <StoneLayer layer={stack.length} opacity={PREVIEW_OPACITY}>
                  <GamePiece3D tone={previewOwnerId === firstPlayerId ? 'primary' : 'highlight'} />
                </StoneLayer>
              )}
              {stack.length === TG_MAX_HEIGHT && (
                <span className="bg-cdm-fg text-cdm-fg-inverse pointer-events-none absolute -top-1 -right-1 z-20 flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-black">
                  3
                </span>
              )}
            </Tag>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
