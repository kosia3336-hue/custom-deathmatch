import type { BankBet, BankPhase } from '../shared/types/bank-game';
import { sumBetAmount } from '../shared/types/bank-game';

/** 결과 대기는 정산, 경기 종료는 네 단계 완료 상태다. */
export function bankProgressIndex(phase: BankPhase): number {
  switch (phase) {
    case 'firstSubmit':
      return 0;
    case 'firstReveal':
      return 1;
    case 'secondSubmit':
      return 2;
    case 'reveal':
    case 'roundEnd':
      return 3;
    case 'finished':
      return 4;
  }
}

export function needsBankZeroBetConfirmation(phase: BankPhase, bet: BankBet): boolean {
  return phase === 'firstSubmit' && sumBetAmount(bet) === 0;
}
