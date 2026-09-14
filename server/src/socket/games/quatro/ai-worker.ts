import { parentPort } from 'worker_threads';
import {
  pickQuatroAdvisor,
  QUATRO_SUPER_THINK_MS,
  type QuatroSuperWorkerRequest,
  type QuatroSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: QuatroSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? QUATRO_SUPER_THINK_MS;
  const pick = pickQuatroAdvisor(data.iAmFirst, data.history ?? [], limit);
  const res: QuatroSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
