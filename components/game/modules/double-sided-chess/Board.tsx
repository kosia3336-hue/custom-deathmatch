'use client';

import { useMemo } from 'react';
import type { Cell as CellType, Owner, Position, PieceType } from '@/shared/types/double-sided-chess';
import { DSC_BOARD_SIZE } from '@/shared/types/double-sided-chess';
import type { SkinTheme } from '@/lib/skins/registry';
import Cell from './Cell';

interface Props {
  board: CellType[][];
  lastMove: { from: Position | null; to: Position; captured?: PieceType | null } | null;
  /** 미지정 시 readonly 모드 (클릭 불가, 어둡게 처리 없음) */
  myOwner?: Owner | null;
  selectedPiece?: Position | null;
  validMoves?: Position[];
  isMyTurn?: boolean;
  winner?: string | null;
  skin?: SkinTheme | null;
  /** 터치 첫 탭 — 둘 자리에 반투명으로 보여 줄 말 */
  ghost?: { row: number; col: number; piece: PieceType; owner: Owner } | null;
  onCellClick?: (row: number, col: number) => void;
}

export const BOARD_STYLE = {
  display: 'grid',
  gridTemplateColumns: `repeat(${DSC_BOARD_SIZE}, 1fr)`,
  gridTemplateRows: `repeat(${DSC_BOARD_SIZE}, 1fr)`,
  width: 'min(min(88vw, 60vh), 580px)',
  height: 'min(min(88vw, 60vh), 580px)',
} as const;

export default function Board({
  board,
  myOwner = null,
  selectedPiece = null,
  validMoves = [],
  lastMove,
  isMyTurn = false,
  winner = null,
  skin,
  ghost = null,
  onCellClick,
}: Props) {
  const readonly = !onCellClick;
  const isImperial = skin === 'imperial';

  const validSet = useMemo(
    () => new Set(validMoves.map((p) => `${p.row},${p.col}`)),
    [validMoves],
  );

  const lastFromKey = lastMove?.from ? `${lastMove.from.row},${lastMove.from.col}` : null;
  const lastToKey = lastMove ? `${lastMove.to.row},${lastMove.to.col}` : null;

  return (
    <div
      className={
        isImperial
          ? `rounded-lg border border-transparent shadow-md skin-imperial-board${winner ? ' skin-imperial-win' : ''}`
          : 'rounded-lg border border-[#8b6914]/50 bg-[#d4a574] shadow-md'
      }
      style={BOARD_STYLE}
    >
      {board.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          const isSelected = selectedPiece?.row === r && selectedPiece?.col === c;
          const isValid = validSet.has(key);
          const isCaptureTarget = isValid && !!cell && cell.owner !== myOwner;

          let clickable = false;
          if (!readonly && !winner && isMyTurn) {
            if (cell && cell.owner === myOwner) clickable = true;
            if (isValid) clickable = true;
          }

          let territory: 'first' | 'second' | null = null;
          if (r === 0) territory = 'second';
          else if (r === DSC_BOARD_SIZE - 1) territory = 'first';

          return (
            <Cell
              key={key}
              cell={cell}
              row={r}
              col={c}
              isSelected={isSelected}
              isValidMove={isValid && !cell}
              isCaptureTarget={isCaptureTarget}
              isLastMoveFrom={key === lastFromKey}
              isLastMoveTo={key === lastToKey}
              isCaptureDest={key === lastToKey && !!lastMove?.captured}
              clickable={clickable}
              isDimmed={!readonly && !!winner}
              isTerritory={territory}
              skin={skin}
              ghost={ghost && ghost.row === r && ghost.col === c ? ghost : null}
              onClick={() => onCellClick?.(r, c)}
            />
          );
        }),
      )}
    </div>
  );
}
