/** 실제 종료 시각을 기준으로 계산하므로 재접속해도 처음부터 시작하지 않는다. */
export function remainingProgress(deadline: number, durationMs: number, now: number): number {
  if (
    !Number.isFinite(deadline) ||
    !Number.isFinite(now) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  )
    return 0;
  return Math.max(0, Math.min(100, ((deadline - now) / durationMs) * 100));
}
