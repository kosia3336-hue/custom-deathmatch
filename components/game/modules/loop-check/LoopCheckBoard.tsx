'use client';

import { useRef, type PointerEvent } from 'react';
import {
  LOOP_CHECK_COLORS,
  LOOP_CHECK_SIZE,
  type LoopCheckBoard as Board,
  type LoopCheckColorMode,
} from '@/shared/types/loop-check';
import { cn } from '@/lib/utils';
import styles from './loop-check.module.css';

export default function LoopCheckBoard({
  board,
  path,
  colorMode,
  onSelect,
}: {
  board: Board;
  path: number[];
  colorMode: LoopCheckColorMode;
  onSelect?: (cell: number) => void;
}) {
  const dragging = useRef(false);
  const lastCell = useRef<number | null>(null);
  const pointerSelect = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return;
    const cell =
      Math.floor((y / bounds.height) * LOOP_CHECK_SIZE) * LOOP_CHECK_SIZE +
      Math.floor((x / bounds.width) * LOOP_CHECK_SIZE);
    if (lastCell.current === cell) return;
    lastCell.current = cell;
    onSelect?.(cell);
  };
  const points = path
    .map((cell) => `${(cell % LOOP_CHECK_SIZE) + 0.5},${Math.floor(cell / LOOP_CHECK_SIZE) + 0.5}`)
    .join(' ');
  return (
    <div className={styles.board}>
      <div
        className={styles.grid}
        role="group"
        aria-label="루프체크 6 곱하기 6 게임판"
        onPointerDown={(event) => {
          if (!onSelect || (event.pointerType === 'mouse' && event.button !== 0)) return;
          event.preventDefault();
          dragging.current = true;
          lastCell.current = null;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerSelect(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current && onSelect) pointerSelect(event);
        }}
        onPointerUp={() => {
          dragging.current = false;
          lastCell.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = false;
          lastCell.current = null;
        }}
        onLostPointerCapture={() => {
          dragging.current = false;
          lastCell.current = null;
        }}
      >
        {board.cells.map((colorId, cell) => {
          const color = LOOP_CHECK_COLORS[colorId]!;
          const step = path.indexOf(cell);
          return (
            <button
              key={cell}
              type="button"
              disabled={!onSelect}
              aria-label={`${Math.floor(cell / 6) + 1}행 ${(cell % 6) + 1}열 ${color.name}${step >= 0 ? `, ${step + 1}번째 선택` : ''}`}
              aria-pressed={step >= 0}
              className={cn(styles.cell, step >= 0 && styles.selected)}
              style={{
                backgroundColor: colorMode === 'colorblind' ? color.accessibleHex : color.hex,
              }}
              onClick={(event) => {
                if (event.detail === 0) onSelect?.(cell);
              }}
            >
              {colorMode === 'colorblind' && (
                <span className={styles.symbol} aria-hidden="true">
                  {color.symbol}
                </span>
              )}
              {step >= 0 && (
                <span className={styles.step} aria-hidden="true">
                  {step + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {path.length > 1 && (
        <svg className={styles.route} viewBox="0 0 6 6" aria-hidden="true">
          <polyline
            points={points}
            fill="none"
            stroke="#101820"
            strokeWidth="0.105"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#fff"
            strokeWidth="0.055"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
