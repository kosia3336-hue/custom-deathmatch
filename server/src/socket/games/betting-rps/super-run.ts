import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRPS_SUPER_THINK_MS,
  type BrpsAdvisorPick,
  type BrpsSuperWorkerRequest,
  type BrpsSuperWorkerResponse,
} from './ai-super.js';
import type { BrpsAdvisorPending, BrpsAdvisorRound } from '@shared/types/betting-rps.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'betting-rps', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateBettingRpsSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isBettingRpsAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runBettingRpsAdvisor(
  key: string,
  iAmFirst: boolean,
  history: BrpsAdvisorRound[],
  pending: BrpsAdvisorPending | undefined,
  timeLimitMs = BRPS_SUPER_THINK_MS,
): Promise<BrpsAdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: BrpsSuperWorkerRequest = { iAmFirst, history, pending, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: BrpsAdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: BrpsSuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[BRPS advisor worker]', err);
      terminateBettingRpsSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[BRPS advisor worker] exit ${code}`);
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
