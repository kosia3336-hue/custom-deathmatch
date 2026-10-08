import type { IndianPokerBettingLimits } from '@/shared/indianPokerBetting';
import { PokerAmountInput } from '@/components/game/poker/PokerAmountInput';

export default function RaiseInput({
  limits,
  onCancel,
  onConfirm,
}: {
  limits: IndianPokerBettingLimits;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}) {
  return (
    <PokerAmountInput
      min={limits.minRaise}
      max={limits.maxRaise}
      enabled={limits.canRaise}
      maximumLabel="올인"
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel={(amount) => `${amount}칩 레이즈`}
    />
  );
}
