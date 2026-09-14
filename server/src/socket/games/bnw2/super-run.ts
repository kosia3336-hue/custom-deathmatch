import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BNW2_SUPER_THINK_MS,
  type Bnw2AdvisorPick,
  type Bnw2SuperWorkerRequest,
  type Bnw2SuperWorkerResponse,
} from './ai-super.js';
import type { Bnw2AdvisorPending, Bnw2AdvisorRound } from '@shared/types/bnw2.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'bnw2', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateBnw2SuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isBnw2AdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runBnw2Advisor(
  key: string,
  iAmFirst: boolean,
  history: Bnw2AdvisorRound[],
  pending: Bnw2AdvisorPending | undefined,
  timeLimitMs = BNW2_SUPER_THINK_MS,
): Promise<Bnw2AdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: Bnw2SuperWorkerRequest = { iAmFirst, history, pending, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: Bnw2AdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: Bnw2SuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[BNW2 advisor worker]', err);
      terminateBnw2SuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[BNW2 advisor worker] exit ${code}`);
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
