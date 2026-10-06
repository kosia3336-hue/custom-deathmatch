import type { IPPlayerInfo } from './types/indian-poker';

type Stack = Pick<IPPlayerInfo, 'chips' | 'roundBet'>;

/** amount는 추가 지출이 아니라 이번 판의 총 베팅량이다. 서버와 UI가 같은 상한을 쓴다. */
export function indianPokerBettingLimits(player?: Stack, opponent?: Stack) {
  const callCost = (opponent?.roundBet ?? 0) - (player?.roundBet ?? 0);
  const minRaise = (opponent?.roundBet ?? 0) + 1;
  const maxRaise = Math.min(
    (player?.roundBet ?? 0) + (player?.chips ?? 0),
    (opponent?.roundBet ?? 0) + (opponent?.chips ?? 0),
  );
  const complete = Boolean(player && opponent);
  return {
    callCost,
    minRaise,
    maxRaise,
    canCall: complete && callCost >= 0 && callCost <= (player?.chips ?? 0),
    canRaise: complete && minRaise <= maxRaise,
  };
}

export type IndianPokerBettingLimits = ReturnType<typeof indianPokerBettingLimits>;

export function clampIndianPokerRaise(amount: number, limits: IndianPokerBettingLimits) {
  return Math.max(limits.minRaise, Math.min(limits.maxRaise, Math.round(amount)));
}
