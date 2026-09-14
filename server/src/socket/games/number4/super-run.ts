import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NF4_SUPER_THINK_MS,
  type Nf4AdvisorPick,
  type Nf4SuperWorkerRequest,
  type Nf4SuperWorkerResponse,
} from './ai-super.js';
import type { Nf4AdvisorRound } from '@shared/types/number4.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'number4', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateNumberFourSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isNumberFourAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runNumberFourAdvisor(
  key: string,
  history: Nf4AdvisorRound[],
  timeLimitMs = NF4_SUPER_THINK_MS,
): Promise<Nf4AdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: Nf4SuperWorkerRequest = { history, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: Nf4AdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: Nf4SuperWorkerResponse) => {
      finish({
        white: move.white,
        black: move.black,
        number: move.number,
        worlds: move.worlds,
        winRate: move.winRate,
      });
    };
    const onError = (err: Error) => {
      console.error('[NF4 advisor worker]', err);
      terminateNumberFourSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[NF4 advisor worker] exit ${code}`);
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
