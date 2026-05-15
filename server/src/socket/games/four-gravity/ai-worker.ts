import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';
import { findBestMoveIterativeStrong } from './ai-strong.js';

parentPort!.on('message', (data: AIWorkerData) => {
  const move = data.useStrong
    ? findBestMoveIterativeStrong(data, 90_000)
    : findBestMoveIterative(data, 60_000);
  parentPort!.postMessage(move);
});
