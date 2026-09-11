'use client';

import { useRef, useEffect, useState } from 'react';
import type { Cell as CellType, Owner, PieceType } from '@/shared/types/double-sided-chess';
import type { SkinTheme } from '@/lib/skins/registry';
import { useSkinFx } from '@/lib/skins/useSkinFx';
import Piece from './Piece';
import CaptureEffect from './CaptureEffect';
import { cn } from '@/lib/utils';

interface Props {
  cell: CellType;
  row?: number;
  col?: number;
  isSelected: boolean;
  isValidMove: boolean;
  isCaptureTarget: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  /** 마지막 이동이 포획이었고 이 셀이 목적지인 경우 true (Board에서 lastMove.captured 기반으로 계산) */
  isCaptureDest?: boolean;
  clickable: boolean;
  isDimmed: boolean;
  isTerritory: 'first' | 'second' | null;
  skin?: SkinTheme | null;
  /** 터치 첫 탭 — 둘 자리에 반투명으로 보여 줄 말 */
  ghost?: { piece: PieceType; owner: Owner } | null;
  onClick: () => void;
}

export default function Cell({
  cell,
  row = 0,
  col = 0,
  isSelected,
  isValidMove,
  isCaptureTarget,
  isLastMoveFrom,
  isLastMoveTo,
  isCaptureDest = false,
  clickable,
  isDimmed,
  isTerritory,
  skin,
  ghost = null,
  onClick,
}: Props) {
  const isImperial = skin === 'imperial';
  const { reducedMotion } = useSkinFx();

  /* ── 잡기 이펙트 감지 ──
   * isCaptureDest: Board가 lastMove.captured로 확실히 판단한 포획 목적지 신호.
   * 이 값이 false→true 로 바뀌는 순간 prevCellRef(포획된 기물)로 이펙트를 실행한다.
   * 내가 잡는 경우와 상대가 내 기물을 잡는 경우 모두 처리한다.
   */
  const prevCellRef       = useRef<CellType | null>(null);
  const wasCaptureDestRef = useRef(false);
  const [capturedPiece, setCapturedPiece] = useState<CellType | null>(null);

  useEffect(() => {
    if (isImperial && isCaptureDest && !wasCaptureDestRef.current) {
      const prev = prevCellRef.current;
      if (prev) setCapturedPiece(prev);
    }
    wasCaptureDestRef.current = isCaptureDest;
    prevCellRef.current       = cell;
  }, [isCaptureDest, cell, isImperial]);

  const bg = isImperial
    ? cn(
        'skin-imperial-cell',
        isSelected
          ? 'skin-imperial-cell-selected'
          : isLastMoveTo
            ? 'skin-imperial-cell-lastto'
            : isLastMoveFrom
              ? 'skin-imperial-cell-lastfrom'
              : isTerritory === 'first'
                ? 'skin-imperial-cell-territory-first'
                : isTerritory === 'second'
                  ? 'skin-imperial-cell-territory-second'
                  : '',
      )
    : isSelected
      ? 'bg-amber-100'
      : isLastMoveTo
        ? 'bg-amber-200/60'
        : isLastMoveFrom
          ? 'bg-[#c8b070]/60'
          : isTerritory === 'first'
            ? 'bg-red-100/30'
            : isTerritory === 'second'
              ? 'bg-blue-100/30'
              : 'bg-[#e8d4a8]';

  const border = isSelected
    ? cn('ring-2 ring-inset ring-amber-400', isImperial && 'skin-imperial-selected')
    : isCaptureTarget
      ? 'ring-2 ring-inset ring-red-400'
      : '';

  return (
    <div
      className={cn(
        'relative border',
        isImperial ? 'border-transparent' : 'border-[#8b6914]/30',
        bg,
        border,
        clickable && 'cursor-pointer',
        isDimmed && 'opacity-40',
      )}
      onClick={clickable ? onClick : undefined}
    >
      {cell && (
        <Piece piece={cell.piece} owner={cell.owner} isPromoted={cell.isPromoted} skin={skin} />
      )}

      {capturedPiece && (
        <CaptureEffect
          piece={capturedPiece.piece}
          owner={capturedPiece.owner}
          isPromoted={capturedPiece.isPromoted}
          skin={skin}
          reducedMotion={reducedMotion}
          onComplete={() => setCapturedPiece(null)}
        />
      )}

      {ghost && !cell && (
        <div className="pointer-events-none absolute inset-0 opacity-55 ring-2 ring-inset ring-amber-400" aria-hidden>
          <Piece piece={ghost.piece} owner={ghost.owner} isPromoted={false} skin={skin} />
        </div>
      )}

      {isValidMove && !cell && !ghost && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn('h-[30%] w-[30%] rounded-full', isImperial ? 'bg-amber-300/70 shadow-[0_0_8px_rgba(245,210,122,0.8)]' : 'bg-green-500/50')} />
        </div>
      )}

      {isCaptureTarget && cell && (
        <div className={cn('absolute inset-0', isImperial ? 'bg-amber-400/20' : 'bg-red-400/20')} />
      )}
    </div>
  );
}
