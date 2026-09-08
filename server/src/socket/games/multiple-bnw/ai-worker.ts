import { parentPort } from 'worker_threads';
import {
  pickMultipleBnwAdvisor,
  MBNW_SUPER_THINK_MS,
  type MbnwSuperWorkerRequest,
  type MbnwSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: MbnwSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? MBNW_SUPER_THINK_MS;
  const pick = pickMultipleBnwAdvisor(data.iAmFirst, data.history ?? [], data.pending, limit);
  const res: MbnwSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
