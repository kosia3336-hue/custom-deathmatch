import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WS_SUPER_THINK_MS,
  type WsAdvisorPick,
  type WsSuperWorkerRequest,
  type WsSuperWorkerResponse,
} from './ai-super.js';
import type { WsAdvisorRound } from '@shared/types/winning-streak.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'winning-streak', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateWinningStreakSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isWinningStreakAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runWinningStreakAdvisor(
  key: string,
  history: WsAdvisorRound[],
  timeLimitMs = WS_SUPER_THINK_MS,
): Promise<WsAdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: WsSuperWorkerRequest = { history, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: WsAdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: WsSuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[WS advisor worker]', err);
      terminateWinningStreakSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[WS advisor worker] exit ${code}`);
        workers.delete(key);
        finish(null);
      }
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage(payload);
  });
}
