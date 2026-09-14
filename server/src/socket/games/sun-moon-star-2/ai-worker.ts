import { parentPort } from 'worker_threads';
import {
  pickSunMoonStar2Advisor,
  SMS2_SUPER_THINK_MS,
  type Sms2SuperWorkerRequest,
  type Sms2SuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: Sms2SuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? SMS2_SUPER_THINK_MS;
  const pick = pickSunMoonStar2Advisor(
    data.iAmFirst,
    data.history ?? [],
    data.pending,
    limit,
  );
  const res: Sms2SuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
