import { parentPort } from 'worker_threads';
import {
  pickGrapeSugar2Advisor,
  GS2_SUPER_THINK_MS,
  type Gs2SuperWorkerRequest,
  type Gs2SuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: Gs2SuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? GS2_SUPER_THINK_MS;
  const pick = pickGrapeSugar2Advisor(data.history ?? [], limit);
  const res: Gs2SuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
