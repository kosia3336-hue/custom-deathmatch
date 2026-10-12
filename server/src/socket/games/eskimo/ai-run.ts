import { Worker } from 'node:worker_threads';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chooseEskimoAiAction, type EskimoAiInput, type EskimoAiResult } from './ai.js';

/*
  방마다 워커 하나. 어려움은 한 수에 몇 초씩 읽어서, 게임 서버 스레드에서 돌리면
  그동안 다른 방의 이벤트가 모두 멈춘다. 보통(2수 읽기)은 가벼워 바로 계산한다.
*/
const workers = new Map<string, Worker>();

function resolveWorkerPath(): string {
  const selfPath = fileURLToPath(import.meta.url);
  return extname(selfPath) === '.ts'
    ? join(dirname(selfPath), 'ai-worker-boot.mjs')
    : join(dirname(selfPath), 'eskimo', 'ai-worker.js');
}

function getWorker(roomId: string): Worker {
  const existing = workers.get(roomId);
  if (existing) return existing;
  const worker = new Worker(resolveWorkerPath());
  worker.unref();
  workers.set(roomId, worker);
  return worker;
}

export function terminateEskimoAiWorker(roomId: string) {
  const worker = workers.get(roomId);
  if (!worker) return;
  workers.delete(roomId);
  void worker.terminate();
}

export function runEskimoAi(roomId: string, input: EskimoAiInput): Promise<EskimoAiResult | null> {
  if (input.difficulty !== 'hard') return Promise.resolve(chooseEskimoAiAction(input));
  let worker: Worker;
  try {
    worker = getWorker(roomId);
  } catch (error) {
    console.error('[ESKIMO ai worker] 시작 실패 — 보통으로 대신 둔다', error);
    return Promise.resolve(chooseEskimoAiAction({ ...input, difficulty: 'normal' }));
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: EskimoAiResult | null) => {
      if (settled) return;
      settled = true;
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
      resolve(result);
    };
    const onMessage = (result: EskimoAiResult | null) => finish(result);
    const onError = (error: Error) => {
      console.error('[ESKIMO ai worker]', error);
      terminateEskimoAiWorker(roomId);
      finish(chooseEskimoAiAction({ ...input, difficulty: 'normal' }));
    };
    const onExit = () => {
      if (workers.get(roomId) === worker) workers.delete(roomId);
      finish(null);
    };
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage(input);
  });
}
