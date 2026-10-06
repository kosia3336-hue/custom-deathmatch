import type { IndianPokerAction } from '@/shared/types/indian-poker';
import type { IndianPokerBettingLimits } from '@/shared/indianPokerBetting';

export default function BettingActions({
  canCheck,
  limits,
  onRaise,
  onAction,
}: {
  canCheck: boolean;
  limits: IndianPokerBettingLimits;
  onRaise: () => void;
  onAction: (action: IndianPokerAction) => void;
}) {
  return (
    <div className="ip-betting-actions">
      <button
        type="button"
        className="ip-betting-action ip-betting-primary"
        disabled={!canCheck && !limits.canCall}
        onClick={() => onAction({ type: canCheck ? 'check' : 'call' })}
      >
        <strong>{canCheck ? '체크' : '콜'}</strong>
        <span>{canCheck ? '추가 베팅 없음' : `${limits.callCost}칩`}</span>
      </button>
      <button
        type="button"
        className="ip-betting-action ip-betting-raise"
        disabled={!limits.canRaise}
        onClick={onRaise}
      >
        <strong>레이즈</strong>
        <span>금액 선택</span>
      </button>
      <button
        type="button"
        className="ip-betting-action ip-betting-fold"
        onClick={() => onAction({ type: 'die' })}
      >
        <strong>폴드</strong>
        <span>이번 판 포기</span>
      </button>
    </div>
  );
}
