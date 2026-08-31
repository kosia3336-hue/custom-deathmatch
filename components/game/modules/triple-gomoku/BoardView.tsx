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

/** 판을 눕히는 각도. 0이면 위에서 내려다보는 평면이다. */
const TILT_DEGREES = 34;
/** 한 층이 올라갈 때 돌 지름 대비 얼마나 밀려 올라가는지. */
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

export type TripleGomokuCellMark = 'none' | 'selected' | 'target' | 'win' | 'last';

export interface TripleGomokuBoardViewProps {
  board: TripleGomokuBoard;
  /** 첫 번째 플레이어 id. 색을 정하는 기준이다. */
  firstPlayerId: string;
  tilted?: boolean;
  markOf?: (cell: TripleGomokuCell) => TripleGomokuCellMark;
  onCellClick?: (cell: TripleGomokuCell) => void;
  isEnabled?: (cell: TripleGomokuCell) => boolean;
  /** 커서를 올린 칸에 이 사람의 돌을 미리 보여 준다. null 이면 미리보기 없음. */
  previewOwnerId?: string | null;
  ariaLabel: string;
  className?: string;
  footer?: ReactNode;
}

const MARK_RING: Record<TripleGomokuCellMark, string> = {
  none: '',
  selected: 'ring-2 ring-cdm-primary bg-cdm-primary-soft',
  target: 'ring-2 ring-cdm-success bg-cdm-success-soft',
  win: 'ring-2 ring-cdm-accent bg-cdm-accent-soft',
  last: 'ring-1 ring-cdm-highlight',
};

export function TripleGomokuBoardView({
  board,
  firstPlayerId,
  tilted = true,
  markOf,
  onCellClick,
  isEnabled,
  previewOwnerId = null,
  ariaLabel,
  className,
  footer,
}: TripleGomokuBoardViewProps) {
  const cells = tripleGomokuCells();
  const edges = tripleGomokuEdges();
  const tilt = tilted ? TILT_DEGREES : 0;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div className={cn('w-full', className)}>
      <div
        className="mx-auto flex w-full items-center justify-center"
        style={{
          maxWidth: '38rem',
          perspective: '1800px',
          // 눕히면 세로가 짧아 보이지만, 쌓인 돌이 위로 솟으므로 높이는 그대로 잡는다.
          aspectRatio: `${TG_BOARD_ASPECT}`,
        }}
      >
        <div
          className="relative w-full origin-center transition-transform duration-300"
          style={{
            aspectRatio: `${TG_BOARD_ASPECT}`,
            transform: `rotateX(${tilt}deg)`,
            transformStyle: 'preserve-3d',
          }}
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
              width="1000"
              height="866"
              rx="28"
              fill="url(#tg-surface)"
              stroke="var(--cdm-border-strong)"
              strokeWidth={2}
            />
            {edges.map(([from, to]) => {
              const a = tripleGomokuPosition(from);
              const b = tripleGomokuPosition(to);
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
              const point = tripleGomokuPosition(cell);
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
            const point = tripleGomokuPosition(cell);
            const stack = board[key] ?? [];
            const mark = markOf?.(cell) ?? 'none';
            const enabled = Boolean(onCellClick) && (isEnabled?.(cell) ?? false);
            // 놓을 수 있는 칸에 커서를 올렸을 때만 반투명 돌로 결과를 미리 보여 준다.
            const showPreview =
              enabled &&
              previewOwnerId != null &&
              hoveredKey === key &&
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
                  enabled ? 'cursor-pointer' : 'cursor-default',
                )}
                style={{
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                  width: '8%',
                  aspectRatio: '1',
                  transform: 'translate(-50%, -50%)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {stack.map((ownerId, layer) => (
                  <span
                    key={`${key}-${layer}`}
                    className="pointer-events-none absolute bottom-1/2 left-1/2 block"
                    style={{
                      width: `${STONE_WIDTH_PERCENT}%`,
                      aspectRatio: STONE_ASPECT,
                      // 아래층은 칸 위에, 윗층은 그만큼 솟는다. 마지막 회전으로 정면을 본다.
                      transform: `translate(-50%, ${STONE_BASE_DROP_PERCENT - layer * LAYER_RISE_PERCENT}%) rotateX(${-tilt}deg)`,
                      // 바닥을 축으로 세워야 돌이 격자점 위에 서 있는 것처럼 보인다.
                      transformOrigin: 'bottom center',
                      zIndex: layer + 1,
                    }}
                  >
                    <GamePiece3D
                      tone={ownerId === firstPlayerId ? 'primary' : 'highlight'}
                      selected={mark === 'selected' && layer === stack.length - 1}
                    />
                  </span>
                ))}
                {showPreview && (
                  <span
                    className="pointer-events-none absolute bottom-1/2 left-1/2 block"
                    style={{
                      width: `${STONE_WIDTH_PERCENT}%`,
                      aspectRatio: STONE_ASPECT,
                      transform: `translate(-50%, ${STONE_BASE_DROP_PERCENT - stack.length * LAYER_RISE_PERCENT}%) rotateX(${-tilt}deg)`,
                      transformOrigin: 'bottom center',
                      opacity: PREVIEW_OPACITY,
                      zIndex: stack.length + 1,
                    }}
                  >
                    <GamePiece3D
                      tone={previewOwnerId === firstPlayerId ? 'primary' : 'highlight'}
                    />
                  </span>
                )}
                {stack.length === TG_MAX_HEIGHT && (
                  <span
                    className="bg-cdm-fg text-cdm-fg-inverse pointer-events-none absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black"
                    style={{ transform: `rotateX(${-tilt}deg)` }}
                  >
                    3
                  </span>
                )}
              </Tag>
            );
          })}
        </div>
      </div>
      {footer}
    </div>
  );
}
