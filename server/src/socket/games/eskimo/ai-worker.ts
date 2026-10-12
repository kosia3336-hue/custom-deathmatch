import { parentPort } from 'worker_threads';
import { chooseEskimoAiAction, type EskimoAiInput, type EskimoAiResult } from './ai.js';

/** 어려움 COM 의 수 읽기를 게임 서버 밖에서 돌린다. */
parentPort!.on('message', (data: EskimoAiInput) => {
  let result: EskimoAiResult | null = null;
  try {
    result = chooseEskimoAiAction(data);
  } catch (error) {
    console.error('[ESKIMO ai worker]', error);
  }
  parentPort!.postMessage(result);
});
