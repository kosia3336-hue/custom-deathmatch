import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';
import { findBestMoveIterativeStrong, findBestMoveIterativeSuper } from './ai-strong.js';

/**
 * 사고 시간 예산 (반복심화 탐색의 상한).
 * 보통 5초, COM 어려움·천하 솔로 토글 90초, `/super-ai` 슈퍼 90초.
 */
const THINK_MS = 5_000;
const THINK_MS_STRONG = 90_000;
const THINK_MS_SUPER = 90_000;

parentPort!.on('message', (data: AIWorkerData) => {
  const move = data.useSuper
    ? findBestMoveIterativeSuper(data, THINK_MS_SUPER)
    : data.useStrong
      ? findBestMoveIterativeStrong(data, THINK_MS_STRONG)
      : findBestMoveIterative(data, THINK_MS);
  parentPort!.postMessage(move);
});
