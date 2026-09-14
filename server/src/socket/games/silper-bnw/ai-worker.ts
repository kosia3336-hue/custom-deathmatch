import { parentPort } from 'worker_threads';
import {
  pickSilperBnwAdvisor,
  SBNW_SUPER_THINK_MS,
  type SbnwSuperWorkerRequest,
  type SbnwSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: SbnwSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? SBNW_SUPER_THINK_MS;
  const pick = pickSilperBnwAdvisor(data.iAmFirst, data.history ?? [], data.pending, limit);
  const res: SbnwSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
