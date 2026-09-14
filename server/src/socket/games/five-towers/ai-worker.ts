import { parentPort } from 'worker_threads';
import {
  pickFiveTowersAdvisor,
  FT_SUPER_THINK_MS,
  type FtSuperWorkerRequest,
  type FtSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: FtSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? FT_SUPER_THINK_MS;
  const pick = pickFiveTowersAdvisor(data.iAmFirst, data.history ?? [], limit);
  const res: FtSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
