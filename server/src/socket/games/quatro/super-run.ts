import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUATRO_SUPER_THINK_MS,
  type QuatroAdvisorPick,
  type QuatroSuperWorkerRequest,
  type QuatroSuperWorkerResponse,
} from './ai-super.js';
import type { QuatroAdvisorPly } from '@shared/types/quatro-advisor.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'quatro', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateQuatroSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isQuatroAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runQuatroAdvisor(
  key: string,
  iAmFirst: boolean,
  history: QuatroAdvisorPly[],
  timeLimitMs = QUATRO_SUPER_THINK_MS,
): Promise<QuatroAdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: QuatroSuperWorkerRequest = { iAmFirst, history, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: QuatroAdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: QuatroSuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[QUATRO advisor worker]', err);
      terminateQuatroSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[QUATRO advisor worker] exit ${code}`);
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
