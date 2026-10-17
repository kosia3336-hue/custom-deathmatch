import { applyRankWin, applyRankLoss, type RankTier } from '@/shared/types/rank';

/** rank_match_history 한 행에서 역산에 필요한 필드만 */
export interface MatchRow {
  id: string;
  season_id: number;
  winner_id: string;
  loser_id: string;
  /** 경기 '후' 티어 (게임 서버가 결과 반영 뒤 상태를 적는다) */
  winner_tier: string;
  winner_rp_before: number;
  winner_rp_gain: number;
  winner_rp_after: number;
  winner_promoted: boolean;
  /** 경기 '후' 티어 */
  loser_tier: string;
  loser_rp_before: number;
  loser_rp_loss: number;
  loser_rp_after: number;
  loser_demoted: boolean;
  played_at: string;
}

export interface RecalcResult {
  memberId: string;
  /** true 면 rank_stats 를 건드리지 않는다. 이유는 warnings 에 있다. */
  skipped: boolean;
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

function sideOf(m: MatchRow, memberId: string) {
  const won = m.winner_id === memberId;
  return {
    won,
    tierAfter: asTier(won ? m.winner_tier : m.loser_tier),
    rpAfter: Number(won ? m.winner_rp_after : m.loser_rp_after),
    amount: Number(won ? m.winner_rp_gain : m.loser_rp_loss),
  };
}

/**
 * 전적 1건을 삭제했을 때 특정 회원의 랭크 상태를 역산한다.
 *
 * 방식: 삭제한 경기 바로 앞 경기의 '경기 후' 상태(티어·RP)에서 출발해,
 * 그 뒤에 실제로 있었던 경기들의 증감을 순서대로 다시 적용(replay)한다.
 * RP 는 티어별 0~99 구간이고 승급 시 100 을 차감하는 구조라
 * 단순히 증감분만 빼면 티어 경계를 넘나든 경우 값이 틀어지기 때문이다.
 * (기록의 *_tier 는 경기 '후' 티어라, 삭제한 경기의 *_tier 로 출발하면 승급·강등이 낀 경기에서 틀어진다.)
 *
 * 랭크 초기화권을 쓰면 그 시점에 시즌 진행도가 0 에서 다시 시작하므로,
 * 초기화 이전 경기는 지금 상태와 무관하다. 그래서
 *  - 삭제한 경기가 마지막 초기화보다 앞이면 아무것도 바꾸지 않는다.
 *  - 그 뒤 경기만으로(remaining) 역산·승패 집계를 한다.
 * 배치 중 경기는 배치 판정을 재현할 수 없어 자동 역산하지 않는다.
 *
 * @param memberId   역산 대상 회원
 * @param deleted    삭제된 경기 행
 * @param remaining  삭제 반영 후 이 시즌 이 회원의 경기 (마지막 초기화 이후만, played_at 오름차순)
 * @param resetAt    이 시즌 마지막 랭크 초기화 시각 (없으면 null)
 */
export function recalcAfterMatchDelete(
  memberId: string,
  deleted: MatchRow,
  remaining: MatchRow[],
  resetAt: string | null = null,
): RecalcResult {
  const warnings: string[] = [];

  if (deleted.winner_id !== memberId && deleted.loser_id !== memberId) {
    throw new Error('해당 회원은 이 경기의 당사자가 아닙니다.');
  }

  const skip = (why: string): RecalcResult => ({
    memberId,
    skipped: true,
    tier: 'unranked',
    rp: 0,
    winStreak: 0,
    lossStreak: 0,
    seasonWins: 0,
    seasonLosses: 0,
    warnings: [why],
  });

  if (resetAt && Date.parse(resetAt) > Date.parse(deleted.played_at)) {
    return skip('삭제한 경기 뒤에 랭크 초기화권을 써서 지금 랭크와 무관합니다. 랭크는 그대로 두었습니다.');
  }

  const after = (m: MatchRow) => !resetAt || Date.parse(m.played_at) > Date.parse(resetAt);
  const matches = remaining.filter(after);
  const prev = [...matches].reverse().find((m) => m.played_at < deleted.played_at);
  const later = matches.filter((m) => m.played_at > deleted.played_at);

  // 배치 중(직전 경기 후에도 배치 전) 이거나 시즌·초기화 뒤 첫 경기면 배치 경기다
  if (!prev || sideOf(prev, memberId).tierAfter === 'unranked') {
    return skip('배치 경기라 자동으로 역산하지 않았습니다. 랭크는 그대로 두었으니 직접 확인하세요.');
  }

  // 1) 삭제한 경기 '직전' 상태 = 바로 앞 경기의 경기 후 상태
  let tier: RankTier = sideOf(prev, memberId).tierAfter;
  let rp = sideOf(prev, memberId).rpAfter;

  // 2) 이후 경기들을 다시 적용
  for (const m of later) {
    const s = sideOf(m, memberId);
    const tierBefore = tier;
    const r = s.won ? applyRankWin(tier, rp, s.amount) : applyRankLoss(tier, rp, s.amount);
    tier = r.tier;
    rp = r.rp;

    // 챌린저 강등은 리더보드 순위에 따라 결정돼 재현할 수 없다
    if (!s.won && m.loser_demoted && tierBefore === 'challenger') {
      warnings.push(
        `${m.played_at.slice(0, 19)} 경기에서 챌린저 강등이 있었습니다. 티어를 직접 확인하세요.`,
      );
    }
  }

  // 3) 시즌 승패는 남은 기록(초기화 이후)에서 직접 집계 — 배치 경기도 승패에 들어간다
  const seasonWins = matches.filter((m) => m.winner_id === memberId).length;
  const seasonLosses = matches.filter((m) => m.loser_id === memberId).length;

  // 4) 연승·연패: 최근부터 같은 결과가 이어진 수. 배치가 끝나면 0 에서 시작하므로 배치 경기 앞에서 멈춘다.
  let winStreak = 0;
  let lossStreak = 0;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const s = sideOf(matches[i], memberId);
    const before = i > 0 ? sideOf(matches[i - 1], memberId).tierAfter : 'unranked';
    if (s.tierAfter === 'unranked' || before === 'unranked') break;
    if (s.won ? lossStreak > 0 : winStreak > 0) break;
    if (s.won) winStreak += 1;
    else lossStreak += 1;
  }

  return {
    memberId,
    skipped: false,
    tier,
    rp,
    winStreak,
    lossStreak,
    seasonWins,
    seasonLosses,
    warnings,
  };
}
