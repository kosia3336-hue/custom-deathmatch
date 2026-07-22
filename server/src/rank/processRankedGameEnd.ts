/**
 * 랭크 멀티 실게임 종료: DB 반영 + game:ended 확장 페이로드
 *
 * ── 2-phase 구조 ─────────────────────────────────────────────
 * Phase 1 (await): loadStats + 인메모리 RP 계산 + recalcChallengerZone
 *   → 계산 완료 즉시 rank:game:ended 전송 → endGame이 game:ended 전송
 *   (화면 멈춤 방지: DB 저장을 기다리지 않음)
 * Phase 2 (background): persistGameEndLog + rank_match_history + saveStats + CDP
 *   → 실패 시 경고 로그만 남기고 무시 (결과 화면엔 이미 올바른 값 표시됨)
 * ─────────────────────────────────────────────────────────────
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
import { onRankedGameEnd as hiddenOnRankedGameEnd } from '../hidden-titles/hooks.js';
import { persistGameEndLog } from '../socket/gameEndPersistence.js';
import type { IO } from '../socket/types.js';
import { sessions } from '../store/sessions.js';
import { grantCdpForRankMatch } from '../cdp/grantCdpForRankMatch.js';
import { grantGuildPoints, GUILD_POINTS } from '../guild/grantGuildPoints.js';
import { claimDailyRankWin } from '../cdp/claimDailyRankWin.js';
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

interface DbPersistContext {
  room: Room;
  result: GameResult;
  seasonId: number;
  idA: string;
  statsA: MutableStats;
  idB: string;
  statsB: MutableStats;
  isDraw: boolean;
  winnerMemberId: string | null;
  loserMemberId: string | null;
  wBefore: MutableStats | null;
  lBefore: MutableStats | null;
  beforeWinnerPlacementDone: boolean;
  beforeLoserPlacementDone: boolean;
  winnerGain: number;
  loserLoss: number;
  promoted: boolean;
  demoted: boolean;
  cdpWinnerId: string | null;
  cdpLoserId: string | null;
  cdpWinnerTierAfter: RankTier;
  cdpLoserTierAfter: RankTier;
}

function asTier(v: string): RankTier {
  if (
    v === 'unranked'
    || v === 'bronze'
    || v === 'silver'
    || v === 'gold'
    || v === 'diamond'
    || v === 'challenger'
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
    challenger: 5,
  };
  return o[t];
}

/**
 * 게임 종료 후 챌린저 구역(150 RP 이상 + 상위 3명) 재계산.
 * - DB는 아직 갱신 전이므로 참가자 RP는 인메모리 값으로 덮어씌워 계산
 * - 참가자: 인메모리 stats 직접 변경
 * - 비참가자: DB 직접 갱신 (순위 밀려 강등/승격된 경우)
 * - 강등 시 RP 유지, 승격 시 season_peak_tier = 'challenger'
 */
async function recalcChallengerZone(
  seasonId: number,
  idA: string,
  statsA: MutableStats,
  idB: string,
  statsB: MutableStats,
): Promise<void> {
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from('rank_stats')
    .select('member_id, tier, rp')
    .eq('season_id', seasonId)
    .in('tier', ['challenger', 'diamond'])
    .eq('placement_done', true)
    .gte('rp', 150);

  if (error) {
    console.warn('[rank] recalcChallengerZone 조회 실패:', error.message);
    return;
  }

  type Entry = { member_id: string; tier: string; rp: number };
  const dbRows = (data ?? []) as Entry[];

  // 참가자는 인메모리 값으로 덮어씌우기 (DB가 아직 반영 전)
  const zoneMap = new Map<string, number>(dbRows.map((r) => [r.member_id, r.rp]));
  for (const [id, stats] of [[idA, statsA], [idB, statsB]] as [string, MutableStats][]) {
    if (!stats.placement_done) continue;
    if (stats.rp >= 150) {
      zoneMap.set(id, stats.rp);
    } else {
      zoneMap.delete(id); // 150 미만 → 챌린저 구역 제외
    }
  }

  // RP 내림차순 정렬 → 상위 3명이 챌린저
  const sorted = [...zoneMap.entries()].sort((a, b) => b[1] - a[1]);
  const challengerSet = new Set(sorted.slice(0, 3).map(([id]) => id));

  // 참가자 인메모리 티어 갱신
  for (const [id, stats] of [[idA, statsA], [idB, statsB]] as [string, MutableStats][]) {
    if (!stats.placement_done) continue;
    if (stats.tier === 'challenger' && !challengerSet.has(id)) {
      stats.tier = 'diamond'; // 강등 (RP 이월)
    } else if (stats.tier === 'diamond' && challengerSet.has(id)) {
      stats.tier = 'challenger'; // 승격
      stats.season_peak_tier = peakTierMax(stats.season_peak_tier, 'challenger');
    }
  }

  // 비참가자 DB 갱신
  const nonParticipants = dbRows.filter((r) => r.member_id !== idA && r.member_id !== idB);
  for (const row of nonParticipants) {
    const shouldChallenger = challengerSet.has(row.member_id);
    const wasChallenger = row.tier === 'challenger';
    if (shouldChallenger === wasChallenger) continue;

    if (shouldChallenger) {
      await sb.from('rank_stats')
        .update({ tier: 'challenger', season_peak_tier: 'challenger' })
        .eq('season_id', seasonId)
        .eq('member_id', row.member_id);
      console.log(`[rank] challenger zone: ${row.member_id} → challenger`);
    } else {
      await sb.from('rank_stats')
        .update({ tier: 'diamond' })
        .eq('season_id', seasonId)
        .eq('member_id', row.member_id);
      console.log(`[rank] challenger zone: ${row.member_id} → diamond`);
    }
  }
}

function rankGameEndedPayload(
  roomId: string,
  o: RankPlayerOutcome,
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
  };
}

function emitRankGameEnded(io: IO, roomId: string, outcome: GameRankOutcome): void {
  for (const o of outcome.players) {
    const token = sessions.getTokenByMemberId(o.memberId);
    if (!token) continue;
    const sid = sessions.getSocketByToken(token);
    if (!sid) continue;
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    sock.emit('rank:game:ended', rankGameEndedPayload(roomId, o));
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

/** 이벤트 쿠폰: 쿠폰함(event_coupon_box)이 열려 있으면 랭크 승자에게 닉네임 쿠폰 1장 지급 */
async function grantEventCoupon(ctx: DbPersistContext, rankMatchId: string | null): Promise<void> {
  if (ctx.isDraw || !ctx.winnerMemberId) return;
  const sb = getSupabaseAdmin();

  const { data: box } = await sb
    .from('event_coupon_box')
    .select('is_open')
    .eq('id', 1)
    .maybeSingle();
  if (!(box as { is_open?: boolean } | null)?.is_open) return;

  const nickname =
    ctx.room.players.find((p) => p.memberId === ctx.winnerMemberId)?.nickname ?? '???';
  const { error } = await sb.from('event_coupons').insert({
    member_id: ctx.winnerMemberId,
    nickname,
    source: 'rank_win',
    ref_id: rankMatchId,
  });
  if (error) console.warn('[rank:persist] event_coupons insert 실패:', error.message);
  else console.log(`[rank:persist] event coupon granted → ${nickname} (${ctx.winnerMemberId})`);
}

/** Phase 2: 게임 로그·랭크 히스토리·RP·CDP를 백그라운드로 DB에 저장 */
async function persistRankedGameEndToDb(io: IO, ctx: DbPersistContext): Promise<void> {
  const sb = getSupabaseAdmin();

  // 게임 로그 저장 (실패해도 계속 진행)
  let gameLogId: string | null = null;
  try {
    gameLogId = await persistGameEndLog(io, ctx.room, ctx.result);
    console.log(`[rank:persist] persistGameEndLog ok gameLogId=${gameLogId}`);
  } catch (err) {
    console.warn('[rank:persist] persistGameEndLog 실패:', (err as Error).message);
  }

  // rank_stats 저장 (병렬)
  await Promise.all([
    saveStats(ctx.seasonId, ctx.idA, ctx.statsA),
    saveStats(ctx.seasonId, ctx.idB, ctx.statsB),
  ]);
  console.log(`[rank:persist] saveStats done idA=${ctx.idA} idB=${ctx.idB}`);

  // rank_match_history 저장 (승/패 케이스)
  let rankMatchId: string | null = null;
  if (!ctx.isDraw && ctx.winnerMemberId && ctx.loserMemberId && ctx.wBefore && ctx.lBefore) {
    const wAfter = ctx.winnerMemberId === ctx.idA ? ctx.statsA : ctx.statsB;
    const lAfter = ctx.loserMemberId === ctx.idA ? ctx.statsA : ctx.statsB;

    const { data: rmhRow, error: insErr } = await sb
      .from('rank_match_history')
      .insert({
        season_id: ctx.seasonId,
        game_log_id: gameLogId,
        winner_id: ctx.winnerMemberId,
        winner_tier: wAfter.tier,
        winner_rp_before: ctx.wBefore.rp,
        winner_rp_gain: ctx.beforeWinnerPlacementDone ? ctx.winnerGain : 0,
        winner_rp_after: wAfter.rp,
        winner_promoted: ctx.promoted,
        loser_id: ctx.loserMemberId,
        loser_tier: lAfter.tier,
        loser_rp_before: ctx.lBefore.rp,
        loser_rp_loss: ctx.beforeLoserPlacementDone ? ctx.loserLoss : 0,
        loser_rp_after: lAfter.rp,
        loser_demoted: ctx.demoted,
        game_id: ctx.room.gameId,
        is_forfeit: ctx.result.endedByForfeit === true,
      })
      .select('id')
      .maybeSingle();

    if (insErr) console.warn('[rank:persist] rank_match_history insert 실패:', insErr.message);
    rankMatchId = (rmhRow as { id?: string } | null)?.id ?? null;

    // 이벤트 쿠폰 지급 — 쿠폰함이 열려 있는 동안 랭크 승리 1회당 1장 (실패 무시)
    try {
      await grantEventCoupon(ctx, rankMatchId);
    } catch (err) {
      console.warn('[rank:persist] event coupon 지급 실패:', (err as Error).message);
    }
  }

  // CDP 적립
  const cdpRefId = !ctx.isDraw ? rankMatchId : gameLogId;
  if (cdpRefId) {
    try {
      if (ctx.isDraw) {
        await grantCdpForRankMatch(io, [
          makeDrawInput(ctx.idA, cdpRefId, ctx.statsA.tier),
          makeDrawInput(ctx.idB, cdpRefId, ctx.statsB.tier),
        ]);
      } else if (ctx.cdpWinnerId && ctx.cdpLoserId) {
        const inputs = computeWinLossInputs({
          winnerId: ctx.cdpWinnerId,
          loserId: ctx.cdpLoserId,
          winnerTierAfter: ctx.cdpWinnerTierAfter,
          loserTierAfter: ctx.cdpLoserTierAfter,
          isForfeit: ctx.result.endedByForfeit === true,
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

  // 길드 포인트 적립 (길드 미가입자는 RPC 내부 no-op)
  try {
    if (ctx.isDraw) {
      await grantGuildPoints([
        { memberId: ctx.idA, amount: GUILD_POINTS.rankDraw, reason: 'rank_draw', ref: gameLogId },
        { memberId: ctx.idB, amount: GUILD_POINTS.rankDraw, reason: 'rank_draw', ref: gameLogId },
      ]);
    } else if (ctx.cdpWinnerId && ctx.cdpLoserId) {
      await grantGuildPoints([
        { memberId: ctx.cdpWinnerId, amount: GUILD_POINTS.rankWin, reason: 'rank_win', ref: rankMatchId },
        { memberId: ctx.cdpLoserId, amount: GUILD_POINTS.rankLoss, reason: 'rank_loss', ref: rankMatchId },
      ]);
    }
  } catch (err) {
    console.warn('[guild:points] 적립 실패(무시):', (err as Error).message);
  }

  // #3 일일 랭크 승리 보너스 (하루 첫 승리 1회 100 CDP) — 승자만, 무승부 제외
  if (!ctx.isDraw && ctx.cdpWinnerId) {
    void claimDailyRankWin(io, ctx.cdpWinnerId);
  }

  // ── 히든 칭호 훅 (천공의 주인 · 심연의 수문장) ────────────────────────
  // rank_match_history 저장 완료 후 호출하므로 이번 판도 포함된다.
  // 승패/무승부 무관하게 두 참가자 모두 체크한다.
  void hiddenOnRankedGameEnd(io, {
    winnerId: ctx.winnerMemberId ?? ctx.idA,
    loserId: ctx.loserMemberId ?? ctx.idB,
    winnerTierAfter: (ctx.winnerMemberId === ctx.idA ? ctx.statsA : ctx.statsB).tier,
    loserTierAfter: (ctx.loserMemberId === ctx.idA ? ctx.statsA : ctx.statsB).tier,
  }).catch((err) => {
    console.warn('[hidden-titles] onRankedGameEnd 실패:', (err as Error).message);
  });
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

  // ── PHASE 1: loadStats + 인메모리 계산 (await) ─────────────────
  const [statsAOrNull, statsBOrNull] = await Promise.all([
    loadStats(seasonId, idA),
    loadStats(seasonId, idB),
  ]);
  console.log(`[rank:finalize] loadStats idA=${idA} ok=${!!statsAOrNull} idB=${idB} ok=${!!statsBOrNull} isDraw=${isDraw}`);
  if (!statsAOrNull || !statsBOrNull) {
    console.log('[rank:finalize] skip — loadStats returned null');
    return { ...result, isRanked: true };
  }

  const statsA = statsAOrNull;
  const statsB = statsBOrNull;
  const beforeA = snapshot(statsA);
  const beforeB = snapshot(statsB);

  let rpBreakdownA: RankPlayerOutcome['rpBreakdown'] | undefined;
  let rpBreakdownB: RankPlayerOutcome['rpBreakdown'] | undefined;
  let rpDeltaA = 0;
  let rpDeltaB = 0;

  // persist context 용 (Phase 2 에 전달)
  let winnerMemberId: string | null = null;
  let loserMemberId: string | null = null;
  let wBefore: MutableStats | null = null;
  let lBefore: MutableStats | null = null;
  let beforeWinnerPlacementDone = false;
  let beforeLoserPlacementDone = false;
  let winnerGain = 0;
  let loserLoss = 0;
  let promoted = false;
  let demoted = false;
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

    winnerMemberId = winnerPl.memberId;
    loserMemberId = loserPl.memberId;

    const winnerStats = winnerPl.memberId === idA ? statsA : statsB;
    const loserStats = loserPl.memberId === idA ? statsA : statsB;

    const wTierVal = tierValForRp(winnerStats);
    const lTierVal = tierValForRp(loserStats);
    beforeWinnerPlacementDone = winnerStats.placement_done;
    beforeLoserPlacementDone = loserStats.placement_done;

    const parts = calcRankRpParts(
      wTierVal,
      lTierVal,
      winnerStats.win_streak,
      loserStats.loss_streak,
    );
    winnerGain = parts.winnerGain;
    loserLoss = parts.loserLoss;

    // 다이아·챌린저가 '하위 티어에게' 졌을 때만 붙던 티어 격차 추가 차감을 제거.
    // 동급 기준치(12)를 상한으로 잡아, 상위 티어에게 졌을 때의 감액 혜택(10/8/6)은 유지한다.
    // 패배 자체의 RP 차감과 연패 가산은 그대로 적용된다.
    const PARITY_BASE_TABLE = 12;
    const loserIsHighTier = loserStats.tier === 'challenger' || loserStats.tier === 'diamond';
    const loserBaseTable = loserIsHighTier
      ? Math.min(parts.loserBaseTable, PARITY_BASE_TABLE)
      : parts.loserBaseTable;
    loserLoss = Math.max(5, loserBaseTable + parts.loserStreakPenalty);

    const winBr = {
      parityReference: 20,
      tierVersusParity: parts.winnerBaseTable - 20,
      streakVersusParity: parts.winnerStreakBonus,
    };
    const loseBr = {
      parityReference: -20,
      tierVersusParity: -(loserBaseTable - 20),
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

    // 챌린저 구역 재계산 (티어 결정에 필요하므로 Phase 1에서 처리)
    await recalcChallengerZone(seasonId, idA, statsA, idB, statsB);

    wBefore = winnerPl.memberId === idA ? beforeA : beforeB;
    lBefore = loserPl.memberId === idA ? beforeA : beforeB;
    const wAfter = winnerPl.memberId === idA ? statsA : statsB;
    const lAfter = loserPl.memberId === idA ? statsA : statsB;

    promoted =
      tierOrderNumeric(wAfter.tier) > tierOrderNumeric(wBefore.tier)
      || (!wBefore.placement_done && wAfter.placement_done && wAfter.tier !== 'unranked');
    demoted = tierOrderNumeric(lAfter.tier) < tierOrderNumeric(lBefore.tier);

    if (beforeWinnerPlacementDone) {
      if (winnerPl.memberId === idA) { rpDeltaA = winnerGain; } else { rpDeltaB = winnerGain; }
    }
    if (beforeLoserPlacementDone) {
      if (loserPl.memberId === idA) { rpDeltaA = -loserLoss; } else { rpDeltaB = -loserLoss; }
    }

    // 쿨다운은 인메모리 처리이므로 즉시 기록
    recordRankPairCooldown(winnerPl.memberId, loserPl.memberId, Date.now());

    cdpWinnerId = winnerPl.memberId;
    cdpLoserId = loserPl.memberId;
    cdpWinnerTierAfter = wAfter.tier;
    cdpLoserTierAfter = lAfter.tier;
  }

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

  // rank:game:ended 즉시 전송 (game:ended 전에 먼저 도착하도록)
  emitRankGameEnded(io, room.id, rankOutcome);

  // ── PHASE 2: DB 저장 (백그라운드) ──────────────────────────────
  persistRankedGameEndToDb(io, {
    room,
    result,
    seasonId,
    idA,
    statsA,
    idB,
    statsB,
    isDraw,
    winnerMemberId,
    loserMemberId,
    wBefore,
    lBefore,
    beforeWinnerPlacementDone,
    beforeLoserPlacementDone,
    winnerGain,
    loserLoss,
    promoted,
    demoted,
    cdpWinnerId,
    cdpLoserId,
    cdpWinnerTierAfter,
    cdpLoserTierAfter,
  }).catch((err) => {
    console.error(`[rank:persist] 백그라운드 저장 실패 roomId=${room.id}:`, (err as Error).message);
  });

  return {
    ...result,
    isRanked: true,
    rankOutcome,
  };
}
