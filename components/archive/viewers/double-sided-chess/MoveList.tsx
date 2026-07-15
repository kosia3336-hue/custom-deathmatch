'use client';

import { useEffect, useRef } from 'react';
import type { DSCTurnActionLog } from '@/shared/types/archive';
import { getPieceLabel } from '@/components/game/modules/double-sided-chess/constants';

interface Props {
  actions: DSCTurnActionLog[];
  currentFrame: number;
  onSelectFrame: (frameIndex: number) => void;
}

const PLAYER_ICON: Record<'first' | 'second', string> = {
  first: '선공',
  second: '후공',
};

export default function MoveList({ actions, currentFrame, onSelectFrame }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentFrame]);

  return (
    <div className="flex flex-col">
      <button
        ref={currentFrame === 0 ? activeRef : null}
        onClick={() => onSelectFrame(0)}
        className={`px-3 py-1.5 text-left text-xs transition-colors ${
          currentFrame === 0
            ? 'bg-indigo-50 font-bold text-indigo-700'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        {currentFrame === 0 && '▶ '}시작
      </button>

      {actions.map((entry, i) => {
        const frameIndex = i + 1;
        const isCurrent = currentFrame === frameIndex;
        const icon = PLAYER_ICON[entry.player];
        const action = entry.action;

        let moveText: string;
        if (action.type === 'move') {
          moveText = `(${action.from.row},${action.from.col})→(${action.to.row},${action.to.col})`;
        } else {
          const label = getPieceLabel(action.pieceType as Parameters<typeof getPieceLabel>[0], false);
          moveText = `${label} 배치(${action.position.row},${action.position.col})`;
        }

        return (
          <button
            key={entry.turnNumber}
            ref={isCurrent ? activeRef : null}
            onClick={() => onSelectFrame(frameIndex)}
            className={`px-3 py-1.5 text-left text-xs transition-colors ${
              isCurrent
                ? 'bg-indigo-50 font-bold text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isCurrent && '▶ '}
            {entry.turnNumber}. {icon} {moveText}
          </button>
        );
      })}
    </div>
  );
}
