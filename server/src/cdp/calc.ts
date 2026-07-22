/**
 * CDP 적립 공식 (docs/features/shop/02-economy.md).
 *  - 승: 15 + tierBonus
 *  - 패: 5
 *  - 무: 8
 *  - 몰수: 승 15 + tierBonus, 패 0 (적립 없음)
 *  - tierBonus: unranked 0 / bronze 1 / silver 2 / gold 3 / diamond 4 / challenger 5
 */
import type { RankTier } from '@shared/types/rank.js';

export const CDP_BASE = {
  win: 15,
  loss: 5,
  draw: 8,
  forfeit_loss: 0,
  forfeit_win: 15,
} as const;

export function tierBonus(tier: RankTier): number {
  switch (tier) {
    case 'bronze':
      return 1;
    case 'silver':
      return 2;
    case 'gold':
      return 3;
    case 'diamond':
      return 4;
    case 'challenger':
      return 5;
    case 'unranked':
    default:
      return 0;
  }
}

export interface CdpGrantInput {
  memberId: string;
  rankMatchId: string;
  amount: number;
  reason: 'rank_win' | 'rank_loss' | 'rank_draw' | 'rank_win_forfeit';
  breakdown: {
    base: number;
    tierBonus: number;
    tierAtGrant: RankTier;
    /** 길드 CDP 수완 버프 레벨 (0/미가입이면 미설정) */
    guildBuffLevel?: number;
    /** 길드 버프로 추가된 CDP */
    guildBuffBonus?: number;
  };
}

interface WinLossArgs {
  winnerId: string;
  loserId: string;
  winnerTierAfter: RankTier;
  loserTierAfter: RankTier;
  isForfeit: boolean;
  rankMatchId: string;
}

export function computeWinLossInputs(a: WinLossArgs): CdpGrantInput[] {
  const winBase = a.isForfeit ? CDP_BASE.forfeit_win : CDP_BASE.win;
  const loseBase = a.isForfeit ? CDP_BASE.forfeit_loss : CDP_BASE.loss;
  const winnerTb = tierBonus(a.winnerTierAfter);

  return [
    {
      memberId: a.winnerId,
      rankMatchId: a.rankMatchId,
      amount: winBase + winnerTb,
      reason: a.isForfeit ? 'rank_win_forfeit' : 'rank_win',
      breakdown: {
        base: winBase,
        tierBonus: winnerTb,
        tierAtGrant: a.winnerTierAfter,
      },
    },
    {
      memberId: a.loserId,
      rankMatchId: a.rankMatchId,
      amount: loseBase,
      reason: 'rank_loss',
      breakdown: {
        base: loseBase,
        tierBonus: 0,
        tierAtGrant: a.loserTierAfter,
      },
    },
  ];
}

export function makeDrawInput(memberId: string, rankMatchId: string, tier: RankTier): CdpGrantInput {
  return {
    memberId,
    rankMatchId,
    amount: CDP_BASE.draw,
    reason: 'rank_draw',
    breakdown: {
      base: CDP_BASE.draw,
      tierBonus: 0,
      tierAtGrant: tier,
    },
  };
}
