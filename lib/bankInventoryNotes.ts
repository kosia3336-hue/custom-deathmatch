import {
  BANK_INITIAL_INVENTORY,
  BANK_TOTAL_ROUNDS,
  type BankBet,
  type BankDenomination,
} from '../shared/types/bank-game';

/** 개인의 잔여 지폐 추정만 저장한다. 상대의 비공개 인벤토리를 사용하지 않는다. */
export type BankInventoryNotes = Record<number, BankBet>;

export function initializeBankInventoryNotes(
  notes: BankInventoryNotes,
  currentRound: number,
): BankInventoryNotes {
  if (!Number.isInteger(currentRound) || currentRound < 1 || currentRound > BANK_TOTAL_ROUNDS)
    return notes;
  let next = notes;
  for (let round = 1; round <= currentRound; round++) {
    if (next[round]) continue;
    next = { ...next, [round]: { ...(next[round - 1] ?? BANK_INITIAL_INVENTORY) } };
  }
  return next;
}

export function updateBankInventoryNote(
  notes: BankInventoryNotes,
  round: number,
  denomination: BankDenomination,
  value: number,
): BankInventoryNotes {
  if (!Number.isFinite(value)) return notes;
  const initialized = initializeBankInventoryNotes(notes, round);
  if (!initialized[round]) return notes;
  return {
    ...initialized,
    [round]: {
      ...initialized[round],
      [denomination]: Math.max(
        0,
        Math.min(BANK_INITIAL_INVENTORY[denomination], Math.floor(value)),
      ),
    },
  };
}

export function resetBankInventoryNote(
  notes: BankInventoryNotes,
  round: number,
): BankInventoryNotes {
  if (!Number.isInteger(round) || round < 1 || round > BANK_TOTAL_ROUNDS) return notes;
  return { ...notes, [round]: { ...BANK_INITIAL_INVENTORY } };
}
