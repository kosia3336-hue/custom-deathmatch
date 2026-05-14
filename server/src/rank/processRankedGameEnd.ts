/**
 * 랭크 멀티 실게임 종료: DB 반영 + game:ended 확장 페이로드
 */
import type { GameRankOutcome, GameResult, RankGameEndedPayload, RankPlayerOutcome } from '@shared/types/events.js';
import type { Player, Room } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import {
  applyRankLoss,
  applyRankWin,
  calcRankRpParts,
  peakTierMax,
  placementTierAndRp,
  rankTierNumericForRp,
  type RankTier,
} from '@shared/types/rank.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import { recordRankPairCooldown } from '../store/rankQueue.js';
import { persistGameEndLog } from '../socket/gameEndPersistence.js';
import type { IO } from '../socket/types.js';
import { sessions } from '../store/sessions.js';
import { grantCdpForRankMatch } from '../cdp/grantCdpForRankMatch.js';
import { computeWinLossInputs, makeDrawInput } from '../cdp/calc.js';

interface MutableStats {
  tier: RankTier;
  rp: number;
  placement_done: boolean;
  placement_games: number;
  placement_wins: number;
  win_streak: number;
  loss_streak: number;
  season_wins: number;
  season_losses: number;
  season_draws: number;
  season_peak_tier: RankTier;
}

function asTier(v: string): RankTier {
  if (
    v === 'unranked'
    || v === 'bronze'
    || v === 'silver'
    || v === 'gold'
    || v === 'diamond'
  ) {
    return v;
  }
  return 'unranked';
}

function rowToMutable(row: Record<string, unknown>): MutableStats {
  return {
    tier: asTier(String(row.tier)),
    rp: Number(row.rp ?? 0),
    placement_done: Boolean(row.placement_done),
    placement_games: Number(row.placement_games ?? 0),
    placement_wins: Number(row.placement_wins ?? 0),
    win_streak: Number(row.win_streak ?? 0),
    loss_streak: Number(row.loss_streak ?? 0),
    season_wins: Number(row.season_wins ?? 0),
    season_losses: Number(row.season_losses ?? 0),
    season_draws: Number(row.season_draws ?? 0),
    season_peak_tier: asTier(String(row.season_peak_tier ?? 'unranked')),
  };
}

function finalizePlacementMut(s: MutableStats): void {
  s.placement_done = true;
  const pl = placementTierAndRp(s.placement_wins);
  s.tier = pl.tier;
  s.rp = pl.rp;
  s.placement_games = Math.min(5, Math.max(s.placement_games, 5));
  s.win_streak = 0;
  s.loss_streak = 0;
  s.season_peak_tier = peakTierMax(s.season_peak_tier, s.tier);
}

function maybeFinalizePlacement(s: MutableStats): void {
  if (s.placement_done) return;
  if (s.placement_games >= 5) finalizePlacementMut(s);
}

function tierValForRp(s: MutableStats): number {
  return rankTierNumericForRp(s.tier, s.placement_done);
}

function snapshot(s: MutableStats): MutableStats {
  return { ...s };
}

function buildOutcome(
  memberId: string,
  nickname: string,
  before: MutableStats,
  after: MutableStats,
  rpDelta: number,
  rpBreakdown?: RankPlayerOutcome['rpBreakdown'],
): RankPlayerOutcome {
  return {
    memberId,
    nickname,
    rpDelta,
    tierBefore: before.tier,
    tierAfter: after.tier,
    rpBefore: before.rp,
    rpAfter: after.rp,
    promoted: false,
    demoted: false,
    placementJustFinished: !before.placement_done && after.placement_done,
    placementMatch: !before.placement_done,
    rpBreakdown,
  };
}

function tierOrderNumeric(t: RankTier): number {
  const o: Record<RankTier, number> = {
    unranked: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
    diamond: 4,
  };
  return o[t];
}

/** 리더보드 UI와 동일: 티어 우선, RP, 동RP는 시즌 승수 내림차순 */
function compareRankRowsServer(
  a: { tier: RankTier; rp: number; wins: number },
  b: { tier: RankTier; rp: number; wins: number },
): number {
  const td = tierOrderNumeric(b.tier) - tierOrderNumeric(a.tier);
  if (td !== 0) return td;
  const rd = b.rp - a.rp;
  if (rd !== 0) return rd;
  return b.wins - a.wins;
}

async function fetchChallengerMemberIds(seasonId: number): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('rank_stats')
    .select('member_id, tier, rp, season_wins')
    .eq('season_id', seasonId)
    .limit(5000);
  if (error || !data?.length) return new Set();
  const rows = data as Array<{ member_id: string; tier: string; rp: number; season_wins: number }>;
  rows.sort((x, y) =>
    compareRankRowsServer(
      { tier: asTier(x.tier), rp: Number(x.rp ?? 0), wins: Number(x.season_wins ?? 0) },
      { tier: asTier(y.tier), rp: Number(y.rp ?? 0), wins: Number(y.season_wins ?? 0) },
    ),
  );
  const CHALLENGER_RP_MIN = 150;
  const ids = new Set<string>();
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const r = rows[i]!;
    if (asTier(String(r.tier)) === 'diamond' && Number(r.rp ?? 0) >= CHALLENGER_RP_MIN) ids.add(r.member_id);
  }
  return ids;
}

function rankGameEndedPayload(
  roomId: string,
  o: RankPlayerOutcome,
  challengerIds: Set<string>,
): RankGameEndedPayload {
  const br = o.rpBreakdown;
  const detail: RankGameEndedPayload['detail'] =
    br == null
      ? null
      : {
          baseRp: br.parityReference,
          tierDiffBonus: br.tierVersusParity,
          streakBonus: br.streakVersusParity,
          total: br.parityReference + br.tierVersusParity + br.streakVersusParity,
        };
  return {
    roomId,
    myRpChange: o.rpDelta,
    detail,
    tierBefore: o.tierBefore,
    tierAfter: o.tierAfter,
    rpBefore: o.rpBefore,
    rpAfter: o.rpAfter,
    promoted: o.promoted,
    demoted: o.demoted,
    placementJustFinished: o.placementJustFinished,
    placementMatch: o.placementMatch,
    isChallenger: challengerIds.has(o.memberId),
  };
}

function emitRankGameEnded(io: IO, roomId: string, outcome: GameRankOutcome, challengerIds: Set<string>): void {
  for (const o of outcome.players) {
    const token = sessions.getTokenByMemberId(o.memberId);
    if (!token) continue;
    const sid = sessions.getSocketByToken(token);
    if (!sid) continue;
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    sock.emit('rank:game:ended', rankGameEndedPayload(roomId, o, challengerIds));
  }
}

function fixPromotedDemoted(o: RankPlayerOutcome, before: MutableStats, after: MutableStats): RankPlayerOutcome {
  const tierUp = tierOrderNumeric(after.tier) > tierOrderNumeric(before.tier);
  const placementAssigned =
    !before.placement_done && after.placement_done && after.tier !== 'unranked';
  const demoted = tierOrderNumeric(after.tier) < tierOrderNumeric(before.tier);
  return {
    ...o,
    promoted: tierUp || placementAssigned,
    demoted,
  };
}

async function loadStats(seasonId: number, memberId: string): Promise<MutableStats | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('rank_stats')
    .select('*')
    .eq('season_id', seasonId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToMutable(data as Record<string, unknown>);
}

async function saveStats(seasonId: number, memberId: string, s: MutableStats): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('rank_stats')
    .update({
      tier: s.tier,
      rp: s.rp,
      placement_done: s.placement_done,
      placement_games: s.placement_games,
      placement_wins: s.placement_wins,
      win_streak: s.win_streak,
      loss_streak: s.loss_streak,
      season_wins: s.season_wins,
      season_losses: s.season_losses,
      season_draws: s.season_draws,
      season_peak_tier: s.season_peak_tier,
      updated_at: new Date().toISOString(),
    })
    .eq('season_id', seasonId)
    .eq('member_id', memberId);

  if (error) throw new Error(error.message);
}

export async function finalizeRankedMultiGameEnd(
  io: IO,
  room: Room,
  result: GameResult,
): Promise<GameResult> {
  console.log(`[rank:finalize] start roomId=${room.id} gameId=${room.gameId} isRanked=${room.isRanked} playMode=${room.playMode}`);
  if (
    room.isRanked !== true
    || room.playMode !== 'multi'
  ) {
    console.log('[rank:finalize] skip — not a ranked multi game');
    return result;
  }

  if (!isSupabaseConfigured()) {
    console.log('[rank:finalize] skip — supabase not configured');
    return { ...result, isRanked: true };
  }

  let gameLogId: string | null = null;
  try {
    gameLogId = await persistGameEndLog(io, room, result);
    console.log(`[rank:finalize] persistGameEndLog ok gameLogId=${gameLogId}`);
  } catch (err) {
    console.warn('[rank] persistGameEndLog 실패:', (err as Error).message);
    throw err;
  }

  const seasonId = room.rankSeasonId;
  if (!seasonId) {
    console.log('[rank:finalize] skip — no rankSeasonId');
    return { ...result, isRanked: true };
  }

  const humans = room.players.filter((p) => p.memberId && p.id !== AI_PLAYER_ID);
  console.log(`[rank:finalize] seasonId=${seasonId} humans=${humans.length} memberIds=${humans.map(h=>h.memberId).join(',')}`);
  if (humans.length !== 2) {
    console.log('[rank:finalize] skip — humans.length !== 2');
    return { ...result, isRanked: true };
  }

  const [pa, pb] = humans as [Player & { memberId: string }, Player & { memberId: string }];
  const idA = pa.memberId!;
  const idB = pb.memberId!;

  const nonAiRankings = result.rankings.filter((r) => r.playerId !== AI_PLAYER_ID);
  const isDraw = nonAiRankings.length > 1 && nonAiRankings.every((r) => r.rank === 1);

  let statsA = await loadStats(seasonId, idA);
  let statsB = await loadStats(seasonId, idB);
  console.log(`[rank:finalize] loadStats idA=${idA} ok=${!!statsA} idB=${idB} ok=${!!statsB} isDraw=${isDraw} nonAiRankings=${nonAiRankings.length}`);
  if (!statsA || !statsB) {
    console.log('[rank:finalize] skip — loadStats returned null');
    return { ...result, isRanked: true };
  }

  const beforeA = snapshot(statsA);
  const beforeB = snapshot(statsB);

  let rpBreakdownA: RankPlayerOutcome['rpBreakdown'] | undefined;
  let rpBreakdownB: RankPlayerOutcome['rpBreakdown'] | undefined;
  let rpDeltaA = 0;
  let rpDeltaB = 0;

  // CDP 적립용 (블록 내부에서 채워진 뒤 아래 emit 전에 사용)
  let rankMatchId: string | null = null;
  let cdpWinnerId: string | null = null;
  let cdpLoserId: string | null = null;
  let cdpWinnerTierAfter: RankTier = 'unranked';
  let cdpLoserTierAfter: RankTier = 'unranked';

  if (isDraw) {
    if (!statsA.placement_done) {
      statsA.placement_games += 1;
      maybeFinalizePlacement(statsA);
    }
    statsA.season_draws += 1;
    if (!statsB.placement_done) {
      statsB.placement_games += 1;
      maybeFinalizePlacement(statsB);
    }
    statsB.season_draws += 1;
    statsA.season_peak_tier = peakTierMax(statsA.season_peak_tier, statsA.tier);
    statsB.season_peak_tier = peakTierMax(statsB.season_peak_tier, statsB.tier);
  } else {
    const wRank = nonAiRankings.find((r) => r.rank === 1);
    const lRank = nonAiRankings.find((r) => r.rank !== 1);
    const winnerPl = humans.find((p) => p.id === wRank?.playerId);
    const loserPl = humans.find((p) => p.id === lRank?.playerId);
    console.log(`[rank:finalize] wRank.playerId=${wRank?.playerId} lRank.playerId=${lRank?.playerId} humanIds=${humans.map(h=>h.id).join(',')} winnerPl=${winnerPl?.memberId} loserPl=${loserPl?.memberId}`);
    if (!winnerPl?.memberId || !loserPl?.memberId) {
      console.log('[rank:finalize] skip — winner/loser player not found');
      return { ...result, isRanked: true };
    }

    const winnerStats = winnerPl.memberId === idA ? statsA : statsB;
    const loserStats = loserPl.memberId === idA ? statsA : statsB;

    const wTierVal = tierValForRp(winnerStats);
    const lTierVal = tierValForRp(loserStats);
    const beforeWinnerPlacementDone = winnerStats.placement_done;
    const beforeLoserPlacementDone = loserStats.placement_done;

    const parts = calcRankRpParts(
      wTierVal,
      lTierVal,
      winnerStats.win_streak,
      loserStats.loss_streak,
    );
    const { winnerGain, loserLoss } = parts;

    const winBr = {
      parityReference: 20,
      tierVersusParity: parts.winnerBaseTable - 20,
      streakVersusParity: parts.winnerStreakBonus,
    };
    const loseBr = {
      parityReference: -20,
      tierVersusParity: -(parts.loserBaseTable - 20),
      streakVersusParity: -parts.loserStreakPenalty,
    };

    if (beforeWinnerPlacementDone && beforeLoserPlacementDone) {
      rpBreakdownA = idA === winnerPl.memberId ? winBr : loseBr;
      rpBreakdownB = idB === winnerPl.memberId ? winBr : loseBr;
    }

    if (!winnerStats.placement_done) {
      winnerStats.placement_games += 1;
      winnerStats.placement_wins += 1;
      winnerStats.season_wins += 1;
      maybeFinalizePlacement(winnerStats);
    } else {
      const wr = applyRankWin(winnerStats.tier, winnerStats.rp, winnerGain);
      winnerStats.tier = wr.tier;
      winnerStats.rp = wr.rp;
      winnerStats.win_streak += 1;
      winnerStats.loss_streak = 0;
      winnerStats.season_wins += 1;
      winnerStats.season_peak_tier = peakTierMax(winnerStats.season_peak_tier, winnerStats.tier);
    }

    if (!loserStats.placement_done) {
      loserStats.placement_games += 1;
      loserStats.season_losses += 1;
      maybeFinalizePlacement(loserStats);
    } else {
      const lr = applyRankLoss(loserStats.tier, loserStats.rp, loserLoss);
      loserStats.tier = lr.tier;
      loserStats.rp = lr.rp;
      loserStats.loss_streak += 1;
      loserStats.win_streak = 0;
      loserStats.season_losses += 1;
      loserStats.season_peak_tier = peakTierMax(loserStats.season_peak_tier, loserStats.tier);
    }

    const wBefore = winnerPl.memberId === idA ? beforeA : beforeB;
    const lBefore = loserPl.memberId === idA ? beforeA : beforeB;
    const wAfter = winnerPl.memberId === idA ? statsA : statsB;
    const lAfter = loserPl.memberId === idA ? statsA : statsB;

    const promoted =
      tierOrderNumeric(wAfter.tier) > tierOrderNumeric(wBefore.tier)
      || (!wBefore.placement_done && wAfter.placement_done && wAfter.tier !== 'unranked');
    const demoted = tierOrderNumeric(lAfter.tier) < tierOrderNumeric(lBefore.tier);

    // rpDelta: 실제 획득/차감 RP (티어 경계를 넘어도 올바른 값 유지)
    if (beforeWinnerPlacementDone) {
      if (winnerPl.memberId === idA) { rpDeltaA = winnerGain; } else { rpDeltaB = winnerGain; }
    }
    if (beforeLoserPlacementDone) {
      if (loserPl.memberId === idA) { rpDeltaA = -loserLoss; } else { rpDeltaB = -loserLoss; }
    }

    const sb = getSupabaseAdmin();
    const { data: rmhRow, error: insErr } = await sb
      .from('rank_match_history')
      .insert({
        season_id: seasonId,
        game_log_id: gameLogId,
        winner_id: winnerPl.memberId,
        winner_tier: wAfter.tier,
        winner_rp_before: wBefore.rp,
        winner_rp_gain: beforeWinnerPlacementDone ? winnerGain : 0,
        winner_rp_after: wAfter.rp,
        winner_promoted: promoted,
        loser_id: loserPl.memberId,
        loser_tier: lAfter.tier,
        loser_rp_before: lBefore.rp,
        loser_rp_loss: beforeLoserPlacementDone ? loserLoss : 0,
        loser_rp_after: lAfter.rp,
        loser_demoted: demoted,
        game_id: room.gameId,
        is_forfeit: result.endedByForfeit === true,
      })
      .select('id')
      .maybeSingle();

    if (insErr) console.warn('[rank] rank_match_history insert 실패:', insErr.message);
    rankMatchId = (rmhRow as { id?: string } | null)?.id ?? null;

    recordRankPairCooldown(winnerPl.memberId, loserPl.memberId, Date.now());

    // CDP 적립용 (승/패 케이스)
    cdpWinnerId = winnerPl.memberId;
    cdpLoserId = loserPl.memberId;
    cdpWinnerTierAfter = wAfter.tier;
    cdpLoserTierAfter = lAfter.tier;
  }

  await saveStats(seasonId, idA, statsA);
  await saveStats(seasonId, idB, statsB);
  console.log(`[rank:finalize] saveStats done idA=${idA} placement_games=${statsA.placement_games} idB=${idB} placement_games=${statsB.placement_games}`);

  const oa = fixPromotedDemoted(
    buildOutcome(idA, pa.nickname, beforeA, statsA, rpDeltaA, rpBreakdownA),
    beforeA,
    statsA,
  );
  const ob = fixPromotedDemoted(
    buildOutcome(idB, pb.nickname, beforeB, statsB, rpDeltaB, rpBreakdownB),
    beforeB,
    statsB,
  );

  const rankOutcome: GameRankOutcome = { players: [oa, ob] };
  const challengerIds = await fetchChallengerMemberIds(seasonId);

  // ── CDP 적립 ──────────────────────────────────────────────
  // 멱등키:
  //   - 승/패: rank_match_history.id (rankMatchId)
  //   - 무: rank_match_history 가 없으므로 game_logs.id 를 사용
  const cdpRefId = !isDraw ? rankMatchId : gameLogId;
  if (cdpRefId) {
    try {
      if (isDraw) {
        await grantCdpForRankMatch(io, [
          makeDrawInput(idA, cdpRefId, statsA.tier),
          makeDrawInput(idB, cdpRefId, statsB.tier),
        ]);
      } else if (cdpWinnerId && cdpLoserId) {
        const inputs = computeWinLossInputs({
          winnerId: cdpWinnerId,
          loserId: cdpLoserId,
          winnerTierAfter: cdpWinnerTierAfter,
          loserTierAfter: cdpLoserTierAfter,
          isForfeit: result.endedByForfeit === true,
          challengerIds,
          rankMatchId: cdpRefId,
        });
        await grantCdpForRankMatch(io, inputs);
      }
    } catch (err) {
      console.warn('[cdp:grant] 적립 호출 실패(무시):', (err as Error).message);
    }
  } else {
    console.log('[cdp:grant] skip — refId(=rankMatchId/gameLogId) 없음');
  }

  emitRankGameEnded(io, room.id, rankOutcome, challengerIds);

  return {
    ...result,
    isRanked: true,
    rankOutcome,
  };
}
