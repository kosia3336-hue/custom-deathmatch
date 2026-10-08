import type { BankBet, BankPhase } from '../shared/types/bank-game';
import { sumBetAmount } from '../shared/types/bank-game';

export function needsBankZeroBetConfirmation(phase: BankPhase, bet: BankBet): boolean {
  return phase === 'firstSubmit' && sumBetAmount(bet) === 0;
}
