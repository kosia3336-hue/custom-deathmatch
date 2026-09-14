import { parentPort, Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative, getQuickFallbackMove } from './ai.js';
import {
  findBestMoveIterativeStrong,
  findBestMoveIterativeSuperStats,
  pickSuperSmpStats,
  tryOpeningBook,
  type StrongSearchStats,
} from './ai-strong.js';
import { probeEndgameTable } from './endgame.js';

/**
 * 사고 시간 예산 (반복심화 탐색의 상한).
 * 보통 5초, COM 어려움·천하 솔로 토글 90초, `/super-ai` 슈퍼 90초.
 * 더미는 `timeLimitMs`로 덮어쓴다.
 * 슈퍼 Lazy SMP는 메인+헬퍼 워커 2. 헬퍼는 smpHelper 로 재귀 spawn 안 함.
 */
const THINK_MS = 5_000;
const THINK_MS_STRONG = 90_000;
const THINK_MS_SUPER = 90_000;

function selfWorkerPath(): string {
  if (process.argv[1]) return process.argv[1];
  return fileURLToPath(import.meta.url);
}

function runHelper(data: AIWorkerData, limit: number): Promise<StrongSearchStats | null> {
  return new Promise((resolve) => {
    let settled = false;
    let helper: Worker;
    try {
      helper = new Worker(selfWorkerPath());
    } catch (err) {
      console.error('[DSC SMP] helper spawn failed', err);
      resolve(null);
      return;
    }

    const settle = (value: StrongSearchStats | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      helper.terminate().catch(() => undefined);
      resolve(value);
    };

    const timer = setTimeout(() => settle(null), limit + 2_000);
    helper.once('message', (res: StrongSearchStats) => {
      settle(res?.move ? res : null);
    });
    helper.once('error', (err) => {
      console.error('[DSC SMP] helper error', err);
      settle(null);
    });
    helper.once('exit', () => settle(null));
    helper.postMessage({
      ...data,
      useSuper: true,
      smpHelper: true,
      timeLimitMs: limit,
    });
  });
}

async function handle(data: AIWorkerData): Promise<void> {
  const superMode = data.useSuper === true;
  const strong = data.useStrong === true;
  const limit = data.timeLimitMs
    ?? (superMode ? THINK_MS_SUPER : strong ? THINK_MS_STRONG : THINK_MS);

  try {
    if (superMode && data.smpHelper === true) {
      parentPort!.postMessage(findBestMoveIterativeSuperStats(data, limit));
      return;
    }

    if (superMode) {
      const book = tryOpeningBook(data);
      if (book) {
        parentPort!.postMessage(book);
        return;
      }
      const tb = probeEndgameTable(data.board, data.prisoners, data.currentOwner);
      if (tb) {
        parentPort!.postMessage(tb);
        return;
      }
      const helperPromise = runHelper(data, limit);
      const main = findBestMoveIterativeSuperStats(data, limit);
      const helper = await helperPromise;
      const picked = pickSuperSmpStats(main, helper);
      console.info(
        `[DSC super-smp] depth=${picked.completedDepth} score=${picked.score} helper=${helper?.completedDepth ?? 'none'}`,
      );
      parentPort!.postMessage(picked.move);
      return;
    }

    const move = strong
      ? findBestMoveIterativeStrong(data, limit)
      : findBestMoveIterative(data, limit);
    parentPort!.postMessage(move);
  } catch (err) {
    console.error('[DSC AI Worker]', err);
    parentPort!.postMessage(
      getQuickFallbackMove(data.board, data.prisoners, data.currentOwner),
    );
  }
}

parentPort!.on('message', (data: AIWorkerData) => {
  void handle(data);
});
