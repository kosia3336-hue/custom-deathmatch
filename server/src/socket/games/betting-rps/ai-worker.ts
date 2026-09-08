import { parentPort } from 'worker_threads';
import {
  pickBettingRpsAdvisor,
  BRPS_SUPER_THINK_MS,
  type BrpsSuperWorkerRequest,
  type BrpsSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: BrpsSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? BRPS_SUPER_THINK_MS;
  const pick = pickBettingRpsAdvisor(data.iAmFirst, data.history ?? [], data.pending, limit);
  const res: BrpsSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
