import { parentPort } from 'worker_threads';
import {
  pickNumberFourAdvisorNumber,
  NF4_SUPER_THINK_MS,
  type Nf4SuperWorkerRequest,
  type Nf4SuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: Nf4SuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? NF4_SUPER_THINK_MS;
  const pick = pickNumberFourAdvisorNumber(data.history ?? [], limit);
  const res: Nf4SuperWorkerResponse = {
    white: pick.white,
    black: pick.black,
    number: pick.number,
    worlds: pick.worlds,
    winRate: pick.winRate,
  };
  parentPort!.postMessage(res);
});
