import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';

parentPort!.on('message', (data: AIWorkerData) => {
  const move = findBestMoveIterative(data, 60_000);
  parentPort!.postMessage(move);
});
