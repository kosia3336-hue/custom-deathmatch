import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';
import { findBestMoveIterativeStrong, findBestMoveIterativeSuper } from './ai-strong.js';

/**
 * 사고 시간 예산 (반복심화 탐색의 상한).
 * COM은 ai.ts 기본 엔진 + 방 설정의 고민 시간(기본 5초, 최대 3분).
 * 천하 솔로 토글만 강한 엔진(기본 90초, timeLimitMs가 있으면 그 값).
 * 슈퍼 AI는 90초 슈퍼 엔진. 방 고민 시간은 넘기지 않는다.
 */
const THINK_MS = 5_000;
const THINK_MS_STRONG = 90_000;
const THINK_MS_SUPER = 90_000;

parentPort!.on('message', (data: AIWorkerData) => {
  const move = data.useSuper
    ? findBestMoveIterativeSuper(data, THINK_MS_SUPER)
    : data.useStrong
      ? findBestMoveIterativeStrong(data, data.timeLimitMs ?? THINK_MS_STRONG)
      : findBestMoveIterative(data, data.timeLimitMs ?? THINK_MS);
  parentPort!.postMessage(move);
});
