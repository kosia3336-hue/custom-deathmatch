import { parentPort } from 'worker_threads';
import {
  pickWinningStreakAdvisor,
  WS_SUPER_THINK_MS,
  type WsSuperWorkerRequest,
  type WsSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: WsSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? WS_SUPER_THINK_MS;
  const pick = pickWinningStreakAdvisor(data.history ?? [], limit);
  const res: WsSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
