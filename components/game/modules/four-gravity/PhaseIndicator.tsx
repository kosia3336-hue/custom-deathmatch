'use client';

import type { Phase } from '@/shared/types/four-gravity';

interface Props {
  phase: Phase;
  isMyTurn: boolean;
  winner: string | null;
  serverMessage?: string;
}

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'place', label: '① 돌 놓기' },
  { phase: 'gravity', label: '② 중력 선택' },
  { phase: 'neutral', label: '③ 중립 돌' },
];

export default function PhaseIndicator({ phase, isMyTurn, winner, serverMessage }: Props) {
  if (winner) return null;

  const message = !isMyTurn
    ? (serverMessage ?? '상대 턴입니다. 기다려 주세요...')
    : phase === 'place'
      ? '보드에 돌을 놓으세요'
      : phase === 'gravity'
        ? '중력 방향을 선택하세요'
        : phase === 'neutral'
          ? '경로 위에 중립 돌을 놓으세요'
          : '';

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <span key={step.phase} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">─</span>}
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                phase === step.phase && isMyTurn
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </span>
        ))}
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
