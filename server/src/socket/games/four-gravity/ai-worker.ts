import { parentPort } from 'worker_threads';
import type { AIWorkerData } from './ai.js';
import { findBestMoveIterative } from './ai.js';
import { findBestMoveIterativeStrong } from './ai-strong.js';

/**
 * 사고 시간 예산 (반복심화 탐색의 상한).
 * 이 게임의 탐색은 상한을 늘 다 쓰므로, 이 값이 곧 "AI 가 한 수에 걸리는 시간"이다.
 * 60초는 대국이 멈춘 것처럼 보여서 5초로 줄였다(수 둔 뒤 연출 딜레이가 0.5~1초인
 * 설계 의도에도 맞다). 강한 AI 는 닉네임 '천하' 전용 하드 모드라 그대로 둔다.
 */
const THINK_MS = 5_000;
const THINK_MS_STRONG = 90_000;

parentPort!.on('message', (data: AIWorkerData) => {
  const move = data.useStrong
    ? findBestMoveIterativeStrong(data, THINK_MS_STRONG)
    : findBestMoveIterative(data, THINK_MS);
  parentPort!.postMessage(move);
});
