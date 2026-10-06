'use client';

export function DualityRevealBadge({ success }: { success: boolean }) {
  return (
    <div className={success ? 'skin-duality-success-badge' : 'skin-duality-fail-badge'}>
      <span>{success ? '성공' : '실패'}</span>
    </div>
  );
}

export function DualityScoreChange({ scoreChange }: { scoreChange: number }) {
  if (scoreChange > 0) {
    return (
      <span className="skin-duality-score-positive text-sm font-semibold">+{scoreChange}점</span>
    );
  }
  if (scoreChange < 0) {
    return (
      <span className="skin-duality-score-negative text-sm font-semibold">{scoreChange}점</span>
    );
  }
  return <span className="skin-duality-score-neutral text-sm font-semibold">±0점</span>;
}
