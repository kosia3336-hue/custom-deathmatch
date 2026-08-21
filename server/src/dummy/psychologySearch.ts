/**
 * 심리·동시 제출 게임 공통: 5~90초(모드 30)는 idle sleep 이 아니라 탐색 예산.
 * 메인 스레드를 막지 않도록 배치마다 이벤트 루프에 양보한다.
 * (턴 타이머·소켓이 죽지 않게 — 양면장기 워커와 같은 이유)
 */

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export type PsychologySearchStep = () => void;

/**
 * `budgetMs` 동안 `step` 을 반복한다.
 * 예산 0이어도 `step` 을 최소 1회 실행한다.
 */
export async function runPsychologySearch(
  budgetMs: number,
  step: PsychologySearchStep,
  opts?: { batchSize?: number },
): Promise<{ elapsedMs: number; steps: number }> {
  const batchSize = Math.max(1, opts?.batchSize ?? 128);
  const started = Date.now();
  const deadline = started + Math.max(0, budgetMs);
  let steps = 0;

  step();
  steps += 1;

  while (Date.now() < deadline) {
    for (let i = 0; i < batchSize; i++) {
      if (Date.now() >= deadline) break;
      step();
      steps += 1;
    }
    await yieldEventLoop();
  }

  return { elapsedMs: Date.now() - started, steps };
}
