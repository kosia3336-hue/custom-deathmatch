'use client';
import { ColorBadge } from './ColorBadge';

export function ColorRevealBanner({
  color,
  firstNick,
  stageBefore,
  stageAfter,
}: {
  color: 'black' | 'white';
  firstNick: string;
  stageBefore?: number | null;
  stageAfter?: number | null;
}) {
  const stagesConsumed =
    stageBefore != null && stageAfter != null ? stageBefore - Math.max(stageAfter, 1) : null;
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
      style={{
        animation: 'bnw2ColorReveal 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards',
        animationDelay: '200ms',
        opacity: 0,
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-500">{firstNick}의 색</span>
        {stageBefore != null && stageAfter != null && (
          <span className="text-xs font-medium text-indigo-500">
            {stagesConsumed != null && stagesConsumed > 0
              ? `불이 ${stagesConsumed}칸 꺼집니다.`
              : '불이 꺼지지 않습니다.'}
          </span>
        )}
      </div>
      <ColorBadge color={color} visible />
    </div>
  );
}
