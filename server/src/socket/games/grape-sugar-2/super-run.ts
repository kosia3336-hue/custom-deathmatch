import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GS2_SUPER_THINK_MS,
  type Gs2AdvisorPick,
  type Gs2SuperWorkerRequest,
  type Gs2SuperWorkerResponse,
} from './ai-super.js';
import type { Gs2AdvisorRound } from '@shared/types/grape-sugar-2.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'grape-sugar-2', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateGrapeSugar2SuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isGrapeSugar2AdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runGrapeSugar2Advisor(
  key: string,
  history: Gs2AdvisorRound[],
  timeLimitMs = GS2_SUPER_THINK_MS,
): Promise<Gs2AdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: Gs2SuperWorkerRequest = { history, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: Gs2AdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: Gs2SuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[GS2 advisor worker]', err);
      terminateGrapeSugar2SuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[GS2 advisor worker] exit ${code}`);
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
