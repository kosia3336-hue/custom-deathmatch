'use client';
import { useState } from 'react';
import { BANK_INITIAL_INVENTORY, type BankDenomination } from '@/shared/types/bank-game';
import {
  initializeBankInventoryNotes,
  updateBankInventoryNote,
  resetBankInventoryNote,
  type BankInventoryNotes,
} from '@/lib/bankInventoryNotes';

/** View 소유: 단계, 도킹, 모바일/PC 전환으로 메모가 사라지지 않는다. */
export function useBankInventoryNotes(currentRound: number, gameKey: string) {
  const [stored, setStored] = useState({
    key: gameKey,
    notes: {} as BankInventoryNotes,
    pinnedRound: null as number | null,
  });
  const base = stored.key === gameKey ? stored : { key: gameKey, notes: {}, pinnedRound: null };
  const notes = initializeBankInventoryNotes(base.notes, currentRound);
  const state = notes === base.notes ? base : { ...base, notes };
  if (state !== stored) setStored(state);
  const round = Math.max(1, Math.min(state.pinnedRound ?? currentRound, currentRound));
  return {
    round,
    currentRound,
    note: notes[round] ?? BANK_INITIAL_INVENTORY,
    currentNote: notes[currentRound] ?? BANK_INITIAL_INVENTORY,
    selectRound: (next: number) =>
      setStored((prev) => ({
        ...prev,
        pinnedRound: next === currentRound ? null : Math.max(1, Math.min(next, currentRound)),
      })),
    setNote: (denomination: BankDenomination, value: number) =>
      setStored((prev) => ({
        ...prev,
        notes: updateBankInventoryNote(prev.notes, round, denomination, value),
      })),
    reset: () =>
      setStored((prev) => ({ ...prev, notes: resetBankInventoryNote(prev.notes, round) })),
  };
}
