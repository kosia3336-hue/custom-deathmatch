import { DualityRevealBadge, DualityScoreChange } from './skins/DualityRevealFx';

/** 비공개 수량과 개인 추정값을 공통 표현하되 서버 값과 메모를 합치지 않는다. */
export function TileCount({ actual, predicted }: { actual: number; predicted?: number }) {
  const value = actual < 0 ? predicted : actual;
  return (
    <span className="inline-flex items-baseline gap-px tabular-nums">
      {value !== undefined ? (
        <span className="text-cdm-fg text-xs font-medium">{value}</span>
      ) : (
        <span className="relative -top-px text-[11px] font-normal opacity-40" title="비공개">
          ?
        </span>
      )}
    </span>
  );
}

export function TileQuantities({ white, black }: { white: number; black: number }) {
  return (
    <>
      □{white} ■{black}
    </>
  );
}

export function ScoreDelta({
  value,
  points = false,
  duality = false,
  success,
}: {
  value: number;
  points?: boolean;
  duality?: boolean;
  success?: boolean;
}) {
  if (duality && points) return <DualityScoreChange scoreChange={value} />;
  const text = value > 0 ? `+${value}` : value === 0 && points ? '±0' : String(value);
  const tone =
    success !== undefined
      ? success
        ? 'text-emerald-600'
        : 'text-red-500'
      : value > 0
        ? 'text-emerald-600'
        : value < 0
          ? 'text-red-500'
          : 'text-gray-400';
  return (
    <span className={`shrink-0 tabular-nums ${tone}`}>
      {text}
      {points ? '점' : ''}
    </span>
  );
}

export function ResultBadge({ success, duality }: { success: boolean; duality: boolean }) {
  if (duality) return <DualityRevealBadge success={success} />;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ${success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
    >
      {success ? '성공' : '실패'}
    </div>
  );
}
