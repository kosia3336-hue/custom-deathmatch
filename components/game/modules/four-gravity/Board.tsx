'use client';

import { useMemo } from 'react';
import type { CellType, Phase, Position } from '@/shared/types/four-gravity';
import { BOARD_SIZE } from '@/shared/types/four-gravity';
import type { SkinTheme } from '@/lib/skins/registry';
import Cell from './Cell';
import CosmosFx from './skins/CosmosFx';

interface Props {
  board: CellType[][];
  phase: Phase;
  isMyTurn: boolean;
  previewColor: 'black' | 'white' | null;
  neutralCandidates: Position[];
  placedPosition: Position | null;
  winLine: Position[] | null;
  winner: string | null;
  highlightCells?: Position[];
  skin?: SkinTheme | null;
  /** 판 최대 너비. GameFrame 안에서는 fitBoardWidth() 로 남은 높이에 맞춘다. */
  maxWidth?: string;
  onCellClick: (row: number, col: number) => void;
}

export default function Board({
  board,
  phase,
  isMyTurn,
  previewColor,
  neutralCandidates,
  placedPosition,
  winLine,
  winner,
  highlightCells = [],
  skin,
  maxWidth = 'min(60vh, 500px)',
  onCellClick,
}: Props) {
  const isCosmos = skin === 'cosmos';
  const neutralSet = useMemo(
    () => new Set(neutralCandidates.map((p) => `${p.row},${p.col}`)),
    [neutralCandidates],
  );

  const winLineSet = useMemo(
    () => new Set((winLine ?? []).map((p) => `${p.row},${p.col}`)),
    [winLine],
  );
  const highlightSet = useMemo(
    () => new Set(highlightCells.map((p) => `${p.row},${p.col}`)),
    [highlightCells],
  );

  const isPlacePhase = isMyTurn && phase === 'place' && !winner;
  const isNeutralPhase = isMyTurn && phase === 'neutral' && !winner;
  const hasActionHighlight = highlightCells.some((p) => board[p.row]?.[p.col] === 'empty');
  const hasNeutralHighlight = hasActionHighlight && phase === 'neutral';

  return (
    <div
      className={`grid rounded-lg border shadow-sm ${isCosmos ? 'skin-cosmos-board' : 'border-gray-300 bg-white'} ${hasActionHighlight ? 'gap-px bg-cdm-border' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        width: `min(100%, ${maxWidth})`,
        aspectRatio: '1',
      }}
    >
      {isCosmos && <CosmosFx />}
      {board.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          const isNeutralCandidate = neutralSet.has(key);
          const isWinCell = winLineSet.has(key);
          const isLastPlaced = placedPosition?.row === r && placedPosition?.col === c;

          const isTutorialTarget = highlightSet.has(key);

          let clickable = false;
          if (isPlacePhase && cell === 'empty') {
            clickable = !hasActionHighlight || isTutorialTarget;
          }
          if (isNeutralPhase && isNeutralCandidate) {
            clickable = !hasNeutralHighlight || isTutorialTarget;
          }

          return (
            <Cell
              key={key}
              cellType={cell}
              clickable={clickable}
              isNeutralCandidate={isNeutralCandidate}
              isWinCell={isWinCell}
              isLastPlaced={isLastPlaced}
              isTutorialTarget={isTutorialTarget}
              isDimmed={
                (isNeutralPhase && !isNeutralCandidate && cell === 'empty') ||
                (hasNeutralHighlight && isNeutralCandidate && !isTutorialTarget) ||
                (hasActionHighlight && cell === 'empty' && !isTutorialTarget)
              }
              previewColor={isPlacePhase && cell === 'empty' ? previewColor : null}
              gameOver={!!winner}
              skin={skin}
              onClick={() => onCellClick(r, c)}
            />
          );
        }),
      )}
    </div>
  );
}
