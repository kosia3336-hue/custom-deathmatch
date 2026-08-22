import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';
import { findBestMoveIterativeStrong } from './ai-strong.js';

/**
 * 사고 시간 예산 (반복심화 탐색의 상한).
 * 이 게임의 탐색은 상한을 늘 다 쓰므로, 이 값이 곧 "AI 가 한 수에 걸리는 시간"이다.
 * 보통은 5초 기본 엔진, 어려움은 최대 30초 강한 엔진을 사용한다.
 * 수를 둔 뒤에는 별도의 0.5~1초 연출 딜레이가 적용된다.
 */
const THINK_MS = 5_000;
const THINK_MS_STRONG = 30_000;

parentPort!.on('message', (data: AIWorkerData) => {
  const move = data.useStrong
    ? findBestMoveIterativeStrong(data, THINK_MS_STRONG)
    : findBestMoveIterative(data, THINK_MS);
  parentPort!.postMessage(move);
});
