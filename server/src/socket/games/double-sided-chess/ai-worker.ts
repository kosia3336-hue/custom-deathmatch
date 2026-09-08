import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';
import { findBestMoveIterativeStrong, findBestMoveIterativeSuper } from './ai-strong.js';

/**
 * 사고 시간 예산 (반복심화 탐색의 상한).
 * 보통 5초, COM 어려움·천하 솔로 토글 90초, `/super-ai` 슈퍼 90초.
 * 더미는 `timeLimitMs`로 덮어쓴다.
 */
const THINK_MS = 5_000;
const THINK_MS_STRONG = 90_000;
const THINK_MS_SUPER = 90_000;

parentPort!.on('message', (data: AIWorkerData) => {
  const superMode = data.useSuper === true;
  const strong = data.useStrong === true;
  const limit = data.timeLimitMs
    ?? (superMode ? THINK_MS_SUPER : strong ? THINK_MS_STRONG : THINK_MS);
  const move = superMode
    ? findBestMoveIterativeSuper(data, limit)
    : strong
      ? findBestMoveIterativeStrong(data, limit)
      : findBestMoveIterative(data, limit);
  parentPort!.postMessage(move);
});
