import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SMS2_SUPER_THINK_MS,
  type Sms2AdvisorPick,
  type Sms2SuperWorkerRequest,
  type Sms2SuperWorkerResponse,
} from './ai-super.js';
import type { Sms2AdvisorPending, Sms2AdvisorRound } from '@shared/types/sun-moon-star-2-advisor.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'sun-moon-star-2', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateSunMoonStar2SuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isSunMoonStar2AdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runSunMoonStar2Advisor(
  key: string,
  iAmFirst: boolean,
  history: Sms2AdvisorRound[],
  pending: Sms2AdvisorPending | undefined,
  timeLimitMs = SMS2_SUPER_THINK_MS,
): Promise<Sms2AdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: Sms2SuperWorkerRequest = { iAmFirst, history, pending, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: Sms2AdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: Sms2SuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[SMS2 advisor worker]', err);
      terminateSunMoonStar2SuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[SMS2 advisor worker] exit ${code}`);
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
