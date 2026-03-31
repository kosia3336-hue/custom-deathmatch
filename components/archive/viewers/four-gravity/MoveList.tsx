'use client';

import { useEffect, useRef } from 'react';
import type { FourGravityTurnAction } from '@/shared/types/archive';

const GRAVITY_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  none: '·',
};

interface Props {
  actions: FourGravityTurnAction[];
  currentTurnNumber: number;
  turnFirstFrame: number[];
  onSelectFrame: (frameIndex: number) => void;
}

export default function MoveList({ actions, currentTurnNumber, turnFirstFrame, onSelectFrame }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentTurnNumber]);

  return (
    <div className="flex flex-col overflow-y-auto">
      <button
        ref={currentTurnNumber === 0 ? activeRef : null}
        onClick={() => onSelectFrame(0)}
        className={`px-3 py-1.5 text-left text-xs transition-colors ${
          currentTurnNumber === 0
            ? 'bg-indigo-50 font-bold text-indigo-700'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        {currentTurnNumber === 0 && '▶ '}시작
      </button>

      {actions.map((action, i) => {
        const isCurrent = currentTurnNumber === action.turnNumber;
        const colorIcon = action.color === 'black' ? '●' : '○';
        const frameIndex = turnFirstFrame[i];

        const placeStep = action.steps.find((s) => s.type === 'place');
        const gravStep = action.steps.find((s) => s.type === 'gravity');
        const neutralStep = action.steps.find((s) => s.type === 'neutral');

        const placeText =
          placeStep?.type === 'place' ? `(${placeStep.row},${placeStep.col})` : '';
        const gravText =
          gravStep?.type === 'gravity'
            ? GRAVITY_ARROW[gravStep.direction] ?? '?'
            : '';
        const neutralText =
          neutralStep?.type === 'neutral'
            ? ` ◆(${neutralStep.row},${neutralStep.col})`
            : '';

        return (
          <button
            key={action.turnNumber}
            ref={isCurrent ? activeRef : null}
            onClick={() => onSelectFrame(frameIndex)}
            className={`px-3 py-1.5 text-left text-xs transition-colors ${
              isCurrent
                ? 'bg-indigo-50 font-bold text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isCurrent && '▶ '}
            {action.turnNumber}. {colorIcon}
            {placeText} {gravText}
            {neutralText}
          </button>
        );
      })}
    </div>
  );
}
