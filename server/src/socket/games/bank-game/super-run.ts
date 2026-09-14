import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BANK_SUPER_THINK_MS,
  type BankAdvisorPick,
  type BankSuperWorkerRequest,
  type BankSuperWorkerResponse,
} from './ai-super.js';
import type { BankAdvisorPending, BankAdvisorRound } from '@shared/types/bank-game-advisor.js';

const workers = new Map<string, Worker>();
const busy = new Set<string>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  const isTs = extname(selfPath) === '.ts';
  return isTs
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'bank-game', 'ai-worker.js');
}

function getWorker(key: string): Worker {
  const existing = workers.get(key);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  workers.set(key, worker);
  return worker;
}

export function terminateBankGameSuperWorker(key: string): void {
  const worker = workers.get(key);
  if (!worker) return;
  worker.terminate();
  workers.delete(key);
  busy.delete(key);
}

export function isBankGameAdvisorBusy(key: string): boolean {
  return busy.has(key);
}

export function runBankGameAdvisor(
  key: string,
  iAmFirst: boolean,
  history: BankAdvisorRound[],
  pending: BankAdvisorPending | undefined,
  timeLimitMs = BANK_SUPER_THINK_MS,
): Promise<BankAdvisorPick | null> {
  if (busy.has(key)) return Promise.resolve(null);
  busy.add(key);
  const worker = getWorker(key);
  const payload: BankSuperWorkerRequest = { iAmFirst, history, pending, timeLimitMs };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: BankAdvisorPick | null) => {
      if (settled) return;
      settled = true;
      busy.delete(key);
      cleanup();
      resolve(res);
    };
    const onMessage = (move: BankSuperWorkerResponse) => {
      finish(move);
    };
    const onError = (err: Error) => {
      console.error('[BANK advisor worker]', err);
      terminateBankGameSuperWorker(key);
      finish(null);
    };
    const onExit = (code: number) => {
      if (!settled) {
        if (code !== 0) console.error(`[BANK advisor worker] exit ${code}`);
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
