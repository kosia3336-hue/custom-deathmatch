import { applyRankWin, applyRankLoss, type RankTier } from '@/shared/types/rank';

/** rank_match_history 한 행에서 역산에 필요한 필드만 */
export interface MatchRow {
  id: string;
  season_id: number;
  winner_id: string;
  loser_id: string;
  winner_tier: string;
  winner_rp_before: number;
  winner_rp_gain: number;
  winner_promoted: boolean;
  loser_tier: string;
  loser_rp_before: number;
  loser_rp_loss: number;
  loser_demoted: boolean;
  played_at: string;
}

export interface RecalcResult {
  memberId: string;
  tier: RankTier;
  rp: number;
  winStreak: number;
  lossStreak: number;
  seasonWins: number;
  seasonLosses: number;
  /** 정확히 재현하지 못했을 수 있는 경우의 경고 (챌린저 강등 등) */
  warnings: string[];
}

function asTier(v: string): RankTier {
  const allow: RankTier[] = ['unranked', 'bronze', 'silver', 'gold', 'diamond', 'challenger'];
  return (allow as string[]).includes(v) ? (v as RankTier) : 'unranked';
}

/**
 * 전적 1건을 삭제했을 때 특정 회원의 랭크 상태를 역산한다.
 *
 * 방식: 삭제 대상 경기 '직전' 스냅샷(rank_match_history 에 저장된 *_rp_before / *_tier)에서 출발해,
 * 그 이후에 실제로 있었던 경기들을 순서대로 다시 적용(replay)한다.
 * RP 는 티어별 0~99 구간이고 승급 시 100 을 차감하는 구조라
 * 단순히 증감분만 빼면 티어 경계를 넘나든 경우 값이 틀어지기 때문이다.
 *
 * @param memberId       역산 대상 회원
 * @param deleted        삭제된 경기 행
 * @param laterMatches   삭제된 경기 이후에 치러진 해당 회원의 경기들 (played_at 오름차순)
 * @param allMatches     삭제 반영 후 해당 시즌 해당 회원의 전체 경기 (승패 집계용)
 */
export function recalcAfterMatchDelete(
  memberId: string,
  deleted: MatchRow,
  laterMatches: MatchRow[],
  allMatches: MatchRow[],
): RecalcResult {
  const warnings: string[] = [];

  const wasWinner = deleted.winner_id === memberId;
  if (!wasWinner && deleted.loser_id !== memberId) {
    throw new Error('해당 회원은 이 경기의 당사자가 아닙니다.');
  }

  // 1) 삭제 대상 경기 '직전' 상태로 되돌린다
  let tier: RankTier = asTier(wasWinner ? deleted.winner_tier : deleted.loser_tier);
  let rp = Number(wasWinner ? deleted.winner_rp_before : deleted.loser_rp_before);

  // 2) 이후 경기들을 다시 적용
  let winStreak = 0;
  let lossStreak = 0;

  for (const m of laterMatches) {
    const won = m.winner_id === memberId;

    if (won) {
      const r = applyRankWin(tier, rp, Number(m.winner_rp_gain));
      tier = r.tier;
      rp = r.rp;
      winStreak += 1;
      lossStreak = 0;
    } else {
      const r = applyRankLoss(tier, rp, Number(m.loser_rp_loss));
      tier = r.tier;
      rp = r.rp;
      lossStreak += 1;
      winStreak = 0;

      // 챌린저 강등은 리더보드 순위에 따라 결정돼 재현할 수 없다
      if (m.loser_demoted && asTier(m.loser_tier) === 'challenger') {
        warnings.push(
          `${m.played_at.slice(0, 19)} 경기에서 챌린저 강등이 있었습니다. 티어를 직접 확인하세요.`,
        );
      }
    }
  }

  // 3) 시즌 승패는 남은 기록에서 직접 집계 (가장 정확)
  const seasonWins = allMatches.filter((m) => m.winner_id === memberId).length;
  const seasonLosses = allMatches.filter((m) => m.loser_id === memberId).length;

  /*
    삭제 대상이 가장 최근 경기였다면 replay 할 이후 경기가 없어 스트릭이 0 으로 남는다.
    이 경우 남은 기록의 '최근부터 연속으로 같은 결과'를 세어 스트릭을 복원한다.
    (승/패 중 한쪽만 값을 가지며 나머지는 0 — 게임 서버의 갱신 규칙과 동일)
  */
  if (laterMatches.length === 0) {
    winStreak = 0;
    lossStreak = 0;

    const desc = [...allMatches].sort((a, b) => (a.played_at < b.played_at ? 1 : -1));
    if (desc.length > 0) {
      const lastWon = desc[0].winner_id === memberId;
      for (const m of desc) {
        const won = m.winner_id === memberId;
        if (won !== lastWon) break;
        if (won) winStreak += 1;
        else lossStreak += 1;
      }
    }
  }

  return { memberId, tier, rp, winStreak, lossStreak, seasonWins, seasonLosses, warnings };
}
