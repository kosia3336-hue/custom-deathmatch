import { describe, expect, it } from 'vitest';
import { recalcAfterMatchDelete, type MatchRow } from '../../../lib/rank/recalcAfterMatchDelete';

const ME = 'me';
let seq = 0;
/** 내 쪽 결과만 채운 경기 한 줄. tier 는 경기 '후' 티어. */
function row(
  at: string,
  won: boolean,
  tierAfter: string,
  before: number,
  amount: number,
  after: number,
  flag = false,
): MatchRow {
  const mine = won
    ? { winner_tier: tierAfter, winner_rp_before: before, winner_rp_gain: amount, winner_rp_after: after, winner_promoted: flag }
    : { loser_tier: tierAfter, loser_rp_before: before, loser_rp_loss: amount, loser_rp_after: after, loser_demoted: flag };
  return {
    id: `m${(seq += 1)}`,
    season_id: 4,
    winner_id: won ? ME : 'opp',
    loser_id: won ? 'opp' : ME,
    winner_tier: 'gold', winner_rp_before: 0, winner_rp_gain: 0, winner_rp_after: 0, winner_promoted: false,
    loser_tier: 'gold', loser_rp_before: 0, loser_rp_loss: 0, loser_rp_after: 0, loser_demoted: false,
    ...mine,
    played_at: `2026-10-17T${at}:00+00:00`,
  };
}

describe('랭크 전적 삭제 역산', () => {
  it('승급이 낀 승리를 지우면 승급 전 티어에서 다시 계산한다', () => {
    const placed = [row('00:10', true, 'unranked', 0, 0, 0), row('00:20', true, 'gold', 0, 0, 0, true)];
    const prev = row('01:00', false, 'gold', 99, 10, 89);
    const deleted = row('02:21', true, 'diamond', 89, 12, 1, true);
    const later = [
      row('02:37', false, 'gold', 1, 10, 91, true),
      row('02:46', false, 'gold', 91, 29, 62),
      row('04:57', false, 'gold', 62, 55, 7),
    ];
    const r = recalcAfterMatchDelete(ME, deleted, [...placed, prev, ...later]);
    // 다이아 89 가 아니라 골드 89 → 79 → 50 → 실버 95
    expect(r).toMatchObject({ skipped: false, tier: 'silver', rp: 95, lossStreak: 4, winStreak: 0 });
  });

  it('지운 경기 뒤에 랭크 초기화권을 썼으면 랭크를 그대로 둔다', () => {
    const deleted = row('02:21', false, 'gold', 72, 10, 62);
    const r = recalcAfterMatchDelete(ME, deleted, [], '2026-10-17T05:22:54+00:00');
    expect(r.skipped).toBe(true);
  });

  it('초기화 뒤 경기만으로 승패·연승을 센다', () => {
    const placement = [
      row('05:28', true, 'unranked', 0, 0, 0),
      row('05:35', true, 'unranked', 0, 0, 0),
      row('06:13', true, 'unranked', 0, 0, 0),
      row('06:21', false, 'unranked', 0, 0, 0),
      row('06:33', true, 'gold', 0, 0, 0, true),
    ];
    const old = row('04:00', true, 'gold', 50, 8, 58);
    const prev = row('06:51', true, 'gold', 0, 14, 14);
    const deleted = row('07:00', false, 'gold', 14, 10, 4);
    const later = row('07:25', true, 'gold', 4, 17, 21);
    const r = recalcAfterMatchDelete(
      ME,
      deleted,
      [old, ...placement, prev, later],
      '2026-10-17T05:22:54+00:00',
    );
    expect(r).toMatchObject({ skipped: false, tier: 'gold', rp: 31, seasonWins: 6, seasonLosses: 1, winStreak: 2 });
  });

  it('배치 경기를 지우면 자동 역산하지 않는다', () => {
    const p1 = row('05:28', true, 'unranked', 0, 0, 0);
    const deleted = row('05:35', true, 'unranked', 0, 0, 0);
    expect(recalcAfterMatchDelete(ME, deleted, [p1]).skipped).toBe(true);
    expect(recalcAfterMatchDelete(ME, p1, []).skipped).toBe(true);
  });
});
