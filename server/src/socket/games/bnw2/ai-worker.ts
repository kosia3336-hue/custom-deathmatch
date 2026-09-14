import { parentPort } from 'worker_threads';
import {
  pickBnw2Advisor,
  BNW2_SUPER_THINK_MS,
  type Bnw2SuperWorkerRequest,
  type Bnw2SuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: Bnw2SuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? BNW2_SUPER_THINK_MS;
  const pick = pickBnw2Advisor(data.iAmFirst, data.history ?? [], data.pending, limit);
  const res: Bnw2SuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
