import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FT_SUPER_THINK_MS,
  type FtAdvisorPick,
  type FtSuperWorkerRequest,
  type FtSuperWorkerResponse,
} from './ai-super.js';
import type { FtAdvisorPly } from '@shared/types/five-towers.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'five-towers', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateFiveTowersSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isFiveTowersAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runFiveTowersAdvisor(
  key: string,
  iAmFirst: boolean,
  history: FtAdvisorPly[],
  timeLimitMs = FT_SUPER_THINK_MS,
): Promise<FtAdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: FtSuperWorkerRequest = { iAmFirst, history, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: FtAdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: FtSuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[FT advisor worker]', err);
      terminateFiveTowersSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[FT advisor worker] exit ${code}`);
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
