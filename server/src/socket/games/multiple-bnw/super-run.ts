import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MBNW_SUPER_THINK_MS,
  type MbnwAdvisorPick,
  type MbnwSuperWorkerRequest,
  type MbnwSuperWorkerResponse,
} from './ai-super.js';
import type { MbnwAdvisorPending, MbnwAdvisorRound } from '@shared/types/multiple-bnw.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'multiple-bnw', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateMultipleBnwSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isMultipleBnwAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runMultipleBnwAdvisor(
  key: string,
  iAmFirst: boolean,
  history: MbnwAdvisorRound[],
  pending: MbnwAdvisorPending | undefined,
  timeLimitMs = MBNW_SUPER_THINK_MS,
): Promise<MbnwAdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: MbnwSuperWorkerRequest = { iAmFirst, history, pending, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: MbnwAdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: MbnwSuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[MBNW advisor worker]', err);
      terminateMultipleBnwSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[MBNW advisor worker] exit ${code}`);
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
