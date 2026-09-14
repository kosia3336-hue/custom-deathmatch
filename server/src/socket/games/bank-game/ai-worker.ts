import { parentPort } from 'worker_threads';
import {
  pickBankGameAdvisor,
  BANK_SUPER_THINK_MS,
  type BankSuperWorkerRequest,
  type BankSuperWorkerResponse,
} from './ai-super.js';

parentPort!.on('message', (data: BankSuperWorkerRequest) => {
  const limit = data.timeLimitMs ?? BANK_SUPER_THINK_MS;
  const pick = pickBankGameAdvisor(
    data.iAmFirst,
    data.history ?? [],
    data.pending,
    limit,
  );
  const res: BankSuperWorkerResponse = pick;
  parentPort!.postMessage(res);
});
